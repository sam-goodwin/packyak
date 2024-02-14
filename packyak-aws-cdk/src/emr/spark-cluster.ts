import {
  Arn,
  Duration,
  RemovalPolicy,
  Resource,
  Stack,
} from "aws-cdk-lib/core";
import { CfnCluster } from "aws-cdk-lib/aws-emr";
import { Construct } from "constructs";
import {
  Connections,
  IConnectable,
  IVpc,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Port,
  SecurityGroup,
} from "aws-cdk-lib/aws-ec2";
import {
  Effect,
  IGrantable,
  IPrincipal,
  InstanceProfile,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Market } from "./market.js";
import { Application } from "./application.js";
import { ReleaseLabel } from "./release-label.js";
import { ICatalog } from "./catalog.js";
import { Configuration, combineConfigurations } from "./configuration.js";

export interface InstanceGroup {
  /**
   * @default 1
   */
  instanceCount?: number;
  /**
   * @default m5.xlarge
   */
  instanceType?: InstanceType;
  /**
   * @default SPOT
   */
  market?: Market;
}

export enum ScaleDownBehavior {
  TERMINATE_AT_INSTANCE_HOUR = "TERMINATE_AT_INSTANCE_HOUR",
  TERMINATE_AT_TASK_COMPLETION = "TERMINATE_AT_TASK_COMPLETION",
}

export enum ScalingUnit {
  INSTANCES = "Instances",
  INSTANCE_FLEET_UNITS = "InstanceFleetUnits",
  VCPU = "VCPU",
}

export interface ManagedScalingPolicy {
  computeLimits: {
    unitType: ScalingUnit;
    minimumCapacityUnits: number;
    maximumCapacityUnits: number;
  };
}

export interface SparkClusterProps {
  /**
   * Name of the EMR Cluster.
   */
  clusterName: string;
  /**
   * The VPC to deploy the EMR cluster into.
   */
  vpc: IVpc;
  /**
   * @default - 1 m5.xlarge from SPOT market
   */
  masterInstanceGroup?: InstanceGroup;
  /**
   * @default - 1 m5.xlarge from SPOT market
   */
  coreInstanceGroup?: InstanceGroup;
  /**
   * TODO: support tasks
   *
   * @default - 1 m5.xlarge from SPOT market
   */
  // taskInstanceGroup?: InstanceGroup;
  /**
   * @default None
   */
  idleTimeout?: Duration;
  /**
   * @default {@link ReleaseLabel.LATEST}
   */
  releaseLabel?: ReleaseLabel;
  /**
   * The catalogs to use for the EMR cluster.
   */
  catalogs: Record<string, ICatalog>;
  /**
   * @default {@link ScaleDownBehavior.TERMINATE_AT_TASK_COMPLETION}
   */
  scaleDownBehavior?: ScaleDownBehavior;
  /**
   * @default - No managed scaling policy
   */
  managedScalingPolicy?: ManagedScalingPolicy;
  /**
   * Override EMR Configurations.
   *
   * @default - the {@link catalog}'s configurations + .venv for the user code.
   */
  configurations?: Configuration[];
  /**
   * @default {@link RemovalPolicy.DESTROY}
   */
  removalPolicy?: RemovalPolicy;
}

export class SparkCluster extends Resource implements IGrantable, IConnectable {
  protected readonly resource: CfnCluster;

  public readonly release: ReleaseLabel;

  public readonly grantPrincipal: IPrincipal;

  public readonly connections: Connections;

  constructor(scope: Construct, id: string, props: SparkClusterProps) {
    super(scope, id);

    this.release = props.releaseLabel ?? ReleaseLabel.EMR_7_0_0;

    const m5xlarge = InstanceType.of(InstanceClass.M5, InstanceSize.XLARGE);

    const masterInstanceType =
      props.masterInstanceGroup?.instanceType ?? m5xlarge;
    const coreInstanceType = props.coreInstanceGroup?.instanceType ?? m5xlarge;
    // const taskInstanceType = props.taskInstanceGroup?.instanceType ?? m5xlarge;

    // for least privileges, see:
    // https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-iam-role-for-ec2.html#emr-ec2-role-least-privilege
    const jobFlowRole = new Role(this, "JobFlowRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });

    // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-iam-role-for-ec2.html

    const instanceProfile = new InstanceProfile(this, "InstanceProfile", {
      role: jobFlowRole,
    });
    this.grantPrincipal = jobFlowRole;

    const serviceRole = new Role(this, "ServiceRole", {
      assumedBy: new ServicePrincipal("elasticmapreduce.amazonaws.com"),
      managedPolicies: [
        // TODO: fine-grained policies
        // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-managed-iam-policies.html
        // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-iam-role.html
        ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEMRServicePolicy_v2",
        ),
        // TODO: remove
        ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"),
      ],
    });
    serviceRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["ec2:CreateSecurityGroup"],
        effect: Effect.ALLOW,
        resources: [
          props.vpc.vpcArn,
          Arn.format(
            {
              service: "ec2",
              resource: "security-group",
              resourceName: `*`,
            },
            Stack.of(this),
          ),
        ],
      }),
    );

    // const masterSg = new SecurityGroup(this, "MasterSG", {
    //   vpc: props.vpc,
    // });
    // const executorSg = new SecurityGroup(this, "ExecutorSG", {
    //   vpc: props.vpc,
    // });
    // // TODO: fine-grained access
    // masterSg.connections.allowFrom(executorSg, Port.allTraffic());

    // // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-man-sec-groups.html#emr-sg-elasticmapreduce-sa-private
    // const serviceAccessSg = new SecurityGroup(this, "ServiceAccessSG", {
    //   vpc: props.vpc,
    // });
    // serviceAccessSg.connections.allowFrom(Port.allTraffic());

    // if (props.sageMakerSg) {
    //   masterSg.connections.allowFrom(props.sageMakerSg, Port.tcp(8998));
    // }

    const masterAccessSg = new SecurityGroup(this, "MasterAccessSg", {
      vpc: props.vpc,
    });

    this.connections = masterAccessSg.connections;

    const cluster = new CfnCluster(this, "Resource", {
      name: props.clusterName,
      // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-managed-policy-fullaccess-v2.html
      tags: [
        {
          key: "for-use-with-amazon-emr-managed-policies",
          value: "true",
        },
      ],
      jobFlowRole: instanceProfile.instanceProfileArn,
      serviceRole: serviceRole.roleArn,
      releaseLabel: props.releaseLabel?.label ?? ReleaseLabel.LATEST.label,
      applications: [
        { name: Application.AMAZON_CLOUDWATCH_AGENT },
        { name: Application.LIVY },
        { name: Application.SPARK },
      ],
      instances: {
        additionalMasterSecurityGroups: [masterAccessSg.securityGroupId],
        // TODO: is 1 subnet OK?
        ec2SubnetId: props.vpc.privateSubnets[0].subnetId,
        // emrManagedMasterSecurityGroup: masterSg.securityGroupId,
        // emrManagedSlaveSecurityGroup: executorSg.securityGroupId,
        // serviceAccessSecurityGroup: serviceAccessSg.securityGroupId,
        // TODO: required for instance fleets
        // ec2SubnetIds: {}

        // TODO: add advanced options
        // masterInstanceFleet: {},
        masterInstanceGroup: {
          instanceCount: 1,
          instanceType: masterInstanceType.toString(),
          market: props.masterInstanceGroup?.market ?? Market.ON_DEMAND,
        },
        // TODO: add advanced options
        // coreInstanceFleet: {},
        coreInstanceGroup: {
          instanceCount: props.coreInstanceGroup?.instanceCount ?? 1,
          instanceType: coreInstanceType.toString(),
          market: props.coreInstanceGroup?.market ?? Market.SPOT,
        },
        // TODO: support tasks
        // taskInstanceFleets: {},
        // taskInstanceGroups: {},
      },
      autoTerminationPolicy: props.idleTimeout
        ? {
            idleTimeout: props.idleTimeout.toSeconds(),
          }
        : undefined,
      configurations: combineConfigurations(
        {
          classification: "spark-defaults",
          configurationProperties: {
            // configure spark to use the virtual environment
            "spark.pyspark.python": "python3",
            "spark.pyspark.virtualenv.enabled": "true",
            "spark.pyspark.virtualenv.type": "native",
            "spark.pyspark.virtualenv.bin.path": "/usr/bin/virtualenv",
          },
        },
        ...(Object.entries(props.catalogs).flatMap(([catalogName, catalog]) =>
          catalog.bind(this, catalogName),
        ) ?? []),
      ),
      scaleDownBehavior:
        props.scaleDownBehavior ??
        ScaleDownBehavior.TERMINATE_AT_TASK_COMPLETION,
      managedScalingPolicy: props.managedScalingPolicy,
      // TODO: configure specific Role
      // autoScalingRole: "EMR_AutoScaling_DefaultRole",
    });
    this.resource = cluster;
    cluster.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);
  }
}
