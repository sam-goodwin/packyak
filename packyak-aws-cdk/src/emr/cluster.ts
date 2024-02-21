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
import { CfnCluster } from "aws-cdk-lib/aws-emr";
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
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import {
  Arn,
  Aws,
  Duration,
  Lazy,
  RemovalPolicy,
  Resource,
  Stack,
} from "aws-cdk-lib/core";
import { Construct } from "constructs";
import path from "path";
import { Application } from "./application.js";
import { BootstrapAction } from "./bootstrap-action.js";
import { ICatalog } from "./catalog.js";
import { Configuration, combineConfigurations } from "./configuration.js";
import { JDBC, JDBCProps } from "./jdbc.js";
import { Market } from "./market.js";
import { ReleaseLabel } from "./release-label.js";
import { toCLIArgs } from "./spark-config.js";
import { Step } from "./step.js";
import { CfnDocument } from "aws-cdk-lib/aws-ssm";

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
   * @default - {@link ReleaseLabel.LATEST}
   */
  releaseLabel?: ReleaseLabel;
  /**
   * The catalogs to use for the EMR cluster.
   */
  catalogs: Record<string, ICatalog>;
  /**
   * @default - {@link ScaleDownBehavior.TERMINATE_AT_TASK_COMPLETION}
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
  bootstrapActions?: BootstrapAction[];
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
  /**
   * Installs and configures the SSM agent to run on all Primary, Core and Task nodes.
   *
   * @default false
   */
  installSSMAgent?: boolean;
}

export class Cluster extends Resource implements IGrantable, IConnectable {
  public readonly release: ReleaseLabel;
  public readonly primarySg: SecurityGroup;
  public readonly coreSg: SecurityGroup;
  public readonly serviceAccessSg: SecurityGroup;
  public readonly connections: Connections;
  public readonly grantPrincipal: IPrincipal;
  public readonly extraJavaOptions: Readonly<Record<string, string>>;
  public readonly jobFlowRole: Role;
  public readonly instanceProfile: InstanceProfile;
  public readonly serviceRole: Role;

  private readonly steps: Step[];
  private readonly bootstrapActions: BootstrapAction[];
  private readonly configurations: Configuration[];
  private readonly clusterID: string;

  protected readonly resource: CfnCluster;

  constructor(scope: Construct, id: string, props: ClusterProps) {
    super(scope, id);

    this.extraJavaOptions = { ...(props.extraJavaOptions ?? {}) };
    this.steps = [...(props.steps ?? [])];
    this.configurations = [...(props.configurations ?? [])];
    this.bootstrapActions = [...(props.bootstrapActions ?? [])];

    this.release = props.releaseLabel ?? ReleaseLabel.EMR_7_0_0;

    const m5xlarge = InstanceType.of(InstanceClass.M5, InstanceSize.XLARGE);

    const masterInstanceType =
      props.masterInstanceGroup?.instanceType ?? m5xlarge;
    const coreInstanceType = props.coreInstanceGroup?.instanceType ?? m5xlarge;
    // const taskInstanceType = props.taskInstanceGroup?.instanceType ?? m5xlarge;

    // for least privileges, see:
    // https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-iam-role-for-ec2.html#emr-ec2-role-least-privilege
    this.jobFlowRole = new Role(this, "JobFlowRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
    });

    // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-iam-role-for-ec2.html
    this.instanceProfile = new InstanceProfile(this, "InstanceProfile", {
      role: this.jobFlowRole,
    });
    this.grantPrincipal = this.jobFlowRole;

    this.serviceRole = new Role(this, "ServiceRole", {
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
    this.serviceRole.addToPrincipalPolicy(
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

    // this constructs a globally unique identifier for the cluster for use in ResourceTag IAM policies
    // should work when clusters are deployed via CDK or Service Catalog
    this.clusterID = `${Aws.ACCOUNT_ID}/${Aws.REGION}/${Aws.STACK_NAME}/${props.clusterName}`;

    const cluster = new CfnCluster(this, "Resource", {
      name: props.clusterName,
      // see: https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-managed-policy-fullaccess-v2.html
      tags: [
        {
          key: "for-use-with-amazon-emr-managed-policies",
          value: "true",
        },
        {
          key: "ClusterID",
          value: this.clusterID,
        },
      ],
      jobFlowRole: this.instanceProfile.instanceProfileArn,
      serviceRole: this.serviceRole.roleArn,
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
      bootstrapActions: Lazy.any({
        produce: () => this.bootstrapActions,
      }),
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

    if (props.installSSMAgent) {
      this.installSSMAgent();
    }
  }

  /**
   * Configure the EMR cluster start the Thrift Server and serve JDBC requests on the specified port.
   *
   * @param options to set when running the JDBC server
   * @returns a reference to the JDBC server
   * @example
   * ```ts
   * const sparkSQL = cluster.jdbc({
   *  port: 10000,
   * });
   * sparkSQL.allowFrom(sageMakerDomain);
   * ```
   */
  public jdbc(options: JDBCProps): JDBC {
    return new JDBC(this, options);
  }

  /**
   * Add an EMR Step to the cluster.
   *
   * This step will run when the cluster is started.
   *
   * @param step the step to add
   */
  public addStep(step: Step): void {
    this.steps.push(step);
  }

  /**
   * Add EMR Configurations to the cluster.
   *
   * E.g. spark or hive configurations.
   *
   * @param configurations additional configurations to add
   */
  public addConfig(...configurations: Configuration[]): void {
    this.configurations.push(...configurations);
  }

  /**
   * Add a Bootstrap Action to the cluster.
   *
   * Bootstrap actions are scripts that run on the cluster before Hadoop starts.
   *
   * @param action the bootstrap action to add
   * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-plan-bootstrap.html
   */
  public addBootstrapAction(action: BootstrapAction): void {
    this.bootstrapActions.push(action);
  }

  /**
   * private flag to make {@link installSSMAgent} idempotent
   */
  private isSSMAgentInstalled: boolean | undefined;

  /**
   * Installs the SSM Agent on Primary, Core, and Task nodes.
   *
   * Authorizes the EC2 instances to communicate with the SSM service.
   *
   * @see https://aws.amazon.com/blogs/big-data/securing-access-to-emr-clusters-using-aws-systems-manager/
   */
  public installSSMAgent() {
    if (this.isSSMAgentInstalled) {
      return;
    }
    this.isSSMAgentInstalled = true;
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const singletonId = "packyak::emr::install-ssm-agent";
    const stack = Stack.of(this);
    const bootstrapScript =
      (stack.node.tryFindChild(singletonId) as Asset) ??
      new Asset(stack, singletonId, {
        path: path.join(
          __dirname,
          "..",
          "..",
          "scripts",
          "install-ssm-agent.sh",
        ),
      });
    bootstrapScript.grantRead(this.jobFlowRole);
    this.addBootstrapAction({
      name: "Install SSM Agent",
      scriptBootstrapAction: {
        path: bootstrapScript.s3ObjectUrl,
      },
    });
    // this allows the SSM agent to communicate with the SSM service
    this.jobFlowRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
    );
  }

  /**
   * Grant an permission to start an SSM Session on the EMR cluster.
   *
   * @param grantee the principal to grant the permission to
   *
   * // TODO: figure out how to use SSM Session Documents to:
   * //       1. customize where state is store and encrypt it
   * //       2. customize other session properties
   * //       3. constrain access with IAM Condition: ssm:SessionDocumentAccessCheck
   * @see https://docs.aws.amazon.com/systems-manager/latest/userguide/getting-started-specify-session-document.html
   */
  public grantStartSSMSession(grantee: IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "ssm:DescribeInstanceProperties",
          "ssm:DescribeSessions",
          "ec2:describeInstances",
          "ssm:GetConnectionStatus",
        ],
        // TODO: not sure if this can be constrained
        resources: ["*"],
      }),
    );
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["ssm:StartSession"],
        resources: [
          Arn.format(
            {
              service: "ec2",
              resource: "instance",
              resourceName: "*",
            },
            Stack.of(this),
          ),
        ],
        conditions: {
          StringEquals: {
            // restrict access to only this cluster, as identified by AccountID, Region, StackName and ClusterName
            "ssm:resourceTag/ClusterID": this.clusterID,
          },
        },
      }),
    );
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
