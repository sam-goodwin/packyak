import {
  Arn,
  Duration,
  Lazy,
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
  Peer,
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
import { Step } from "./step.js";
import { JDBC, JDBCProps } from "./jdbc.js";
import { toCLIArgs } from "./spark-config.js";

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

export interface ClusterProps {
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
  /**
   * @default - No bootstrap actions
   */
  bootstrapActions?: CfnCluster.BootstrapActionConfigProperty[];
  /**
   * The EMR Steps to submit to the cluster.
   *
   * @see https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark-submit-step.html
   */
  steps?: Step[];
  /**
   * The concurrency level of the cluster.
   *
   * @default 1
   */
  stepConcurrencyLevel?: number;
  /**
   * Extra java options to include in the Spark context by default.
   */
  extraJavaOptions?: Record<string, string>;
}

export class Cluster extends Resource implements IGrantable, IConnectable {
  public readonly release: ReleaseLabel;
  public readonly primarySg: SecurityGroup;
  public readonly coreSg: SecurityGroup;
  public readonly serviceAccessSg: SecurityGroup;
  public readonly connections: Connections;
  public readonly grantPrincipal: IPrincipal;

  private readonly steps: Step[];
  private readonly configurations: Configuration[];
  public readonly extraJavaOptions: Readonly<Record<string, string>>;

  protected readonly resource: CfnCluster;

  constructor(scope: Construct, id: string, props: ClusterProps) {
    super(scope, id);

    this.extraJavaOptions = props.extraJavaOptions ?? {};
    this.steps = [];
    this.configurations = [];

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

    this.primarySg = new SecurityGroup(this, "PrimarySG", {
      vpc: props.vpc,
      description:
        "The security group for the primary instance (private subnets). See: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-man-sec-groups.html#emr-sg-elasticmapreduce-master-private",
      allowAllOutbound: true,
    });
    this.connections = this.primarySg.connections;
    this.coreSg = new SecurityGroup(this, "CoreSG", {
      vpc: props.vpc,
      description:
        "Security group for core and task instances (private subnets). See: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-man-sec-groups.html#emr-sg-elasticmapreduce-slave-private",
      allowAllOutbound: true,
    });
    this.serviceAccessSg = new SecurityGroup(this, "ServiceAccessSG", {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    this.configureSecurityGroups();

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
      steps: Lazy.any({
        produce: () => this.steps,
      }),
      stepConcurrencyLevel: props.stepConcurrencyLevel,
      bootstrapActions: props.bootstrapActions,
      instances: {
        // TODO: is 1 subnet OK?
        // TODO: required for instance fleets
        ec2SubnetId: props.vpc.privateSubnets[0].subnetId,

        emrManagedMasterSecurityGroup: this.primarySg.securityGroupId,
        emrManagedSlaveSecurityGroup: this.coreSg.securityGroupId,
        serviceAccessSecurityGroup: this.serviceAccessSg.securityGroupId,

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
      configurations: Lazy.any({
        produce: () =>
          combineConfigurations(
            {
              classification: "spark-defaults",
              configurationProperties: {
                // configure spark to use the virtual environment
                "spark.pyspark.python": "python3",
                "spark.pyspark.virtualenv.enabled": "true",
                "spark.pyspark.virtualenv.type": "native",
                "spark.pyspark.virtualenv.bin.path": "/usr/bin/virtualenv",
                "spark.driver.extraJavaOptions": toCLIArgs(
                  this.extraJavaOptions,
                ),
              },
            },
            ...this.configurations,
          ),
      }),
      scaleDownBehavior:
        props.scaleDownBehavior ??
        ScaleDownBehavior.TERMINATE_AT_TASK_COMPLETION,
      managedScalingPolicy: props.managedScalingPolicy,
      // TODO: configure specific Role
      // autoScalingRole: "EMR_AutoScaling_DefaultRole",
    });
    Object.entries(props.catalogs).forEach(([catalogName, catalog]) =>
      catalog.bind(this, catalogName),
    );
    this.resource = cluster;
    cluster.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);
  }

  public addStep(step: Step): void {
    this.steps.push(step);
  }

  public addConfig(...configurations: Configuration[]): void {
    this.configurations.push(...configurations);
  }

  public jdbc(options: JDBCProps): JDBC {
    return new JDBC(this, options);
  }

  /**
   * Allows connections to the Livy server on port 8998 from the specified {@link other} security group.
   */
  public allowLivyFrom(other: IConnectable): void {
    this.connections.allowFrom(other, Port.tcp(8998));
  }

  /**
   * Configure the rules for the Primary, Core, and Service Access security groups.
   */
  private configureSecurityGroups() {
    this.configureMasterSecurityGroup();
    this.configureCoreSecurityGroup();
    this.configureServiceAccessSecurityGroup();
  }

  /**
   * Configure security group for Primary instance (master)
   *
   * All traffic to/from the Primary and Core/Task security groups.
   * All outbound traffic to any IPv4 address.
   *
   * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-man-sec-groups.html#emr-sg-elasticmapreduce-master-private
   */
  private configureMasterSecurityGroup() {
    this.primarySg.connections.allowFrom(
      this.primarySg,
      Port.allTraffic(),
      "Allows the primary (aka. master) node(s) to communicate with each other over ICMP or any TCP or UDP port.",
    );
    this.primarySg.connections.allowFrom(
      this.coreSg,
      Port.allTraffic(),
      "Allows the primary (aka. master) node(s) to communicate with the core and task nodes over ICMP or any TCP or UDP port.",
    );
    this.primarySg.connections.allowFrom(
      this.serviceAccessSg,
      Port.tcp(8443),
      "This rule allows the cluster manager to communicate with the primary node.",
    );
  }

  /**
   * Configure security group for Core & Task nodes
   *
   * All traffic to/from the Primary and Core/Task security groups.
   * All outbound traffic to any IPv4 address.
   *
   * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-man-sec-groups.html#emr-sg-elasticmapreduce-slave-private
   */
  private configureCoreSecurityGroup() {
    this.coreSg.connections.allowFrom(
      this.primarySg,
      Port.allTraffic(),
      "Allows the primary (aka. master) node(s) to communicate with the core and task nodes over ICMP or any TCP or UDP port.",
    );
    this.coreSg.connections.allowFrom(
      this.coreSg,
      Port.allTraffic(),
      "Allows core and task node(s) to communicate with each other over ICMP or any TCP or UDP port.",
    );
    this.coreSg.connections.allowFrom(
      this.serviceAccessSg,
      Port.tcp(8443),
      "This rule allows the cluster manager to communicate with core and task nodes.",
    );
  }

  /**
   * Configure security group for Service Access.
   *
   * It allows inbound traffic on 8443 from the primary security group.
   * It allows outbound traffic on 8443 to the primary and core security groups.
   *
   * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-man-sec-groups.html#emr-sg-elasticmapreduce-sa-private
   */
  private configureServiceAccessSecurityGroup() {
    this.serviceAccessSg.connections.allowFrom(this.primarySg, Port.tcp(9443));
    this.serviceAccessSg.connections.allowTo(this.primarySg, Port.tcp(8443));
    this.serviceAccessSg.connections.allowTo(this.coreSg, Port.tcp(8443));
  }
}
