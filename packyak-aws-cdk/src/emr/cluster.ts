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
import * as path from "path";
import { Application } from "./application";
import { BootstrapAction } from "./bootstrap-action";
import { ICatalog } from "./catalog";
import { Configuration, combineConfigurations } from "./configuration";
import { Jdbc, JdbcProps } from "./jdbc";
import { Market } from "./market";
import { ReleaseLabel } from "./release-label";
import { toCLIArgs } from "./spark-config";
import { Step } from "./step";
import { Workspace } from "../workspace/workspace";
import type { IAccessPoint, IFileSystem } from "aws-cdk-lib/aws-efs";
import { Home } from "../workspace/home";
import { Bucket } from "aws-cdk-lib/aws-s3";

export interface InstanceGroup {
  /**
   * @default 1
   */
  readonly instanceCount?: number;
  /**
   * @default m5.xlarge
   */
  readonly instanceType?: InstanceType;
  /**
   * @default SPOT
   */
  readonly market?: Market;
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
  readonly computeLimits: ComputeLimits;
}

export interface ComputeLimits {
  readonly unitType: ScalingUnit;
  readonly minimumCapacityUnits: number;
  readonly maximumCapacityUnits: number;
}

export interface MountOptions {
  readonly mountPoint: string;
  readonly username: string;
  readonly uid: number;
  readonly gid: number;
}

export interface ClusterProps {
  /**
   * Name of the EMR Cluster.
   */
  readonly clusterName: string;
  /**
   * The VPC to deploy the EMR cluster into.
   */
  readonly vpc: IVpc;
  /**
   * @default - 1 m5.xlarge from SPOT market
   */
  readonly masterInstanceGroup?: InstanceGroup;
  /**
   * @default - 1 m5.xlarge from SPOT market
   */
  readonly coreInstanceGroup?: InstanceGroup;
  /**
   * TODO: support tasks
   *
   * @default - 1 m5.xlarge from SPOT market
   */
  // readonly taskInstanceGroup?: InstanceGroup;
  /**
   * @default None
   */
  readonly idleTimeout?: Duration;
  /**
   * @default - {@link ReleaseLabel.LATEST}
   */
  readonly releaseLabel?: ReleaseLabel;
  /**
   * The catalogs to use for the EMR cluster.
   */
  readonly catalogs: Record<string, ICatalog>;
  /**
   * @default - {@link ScaleDownBehavior.TERMINATE_AT_TASK_COMPLETION}
   */
  readonly scaleDownBehavior?: ScaleDownBehavior;
  /**
   * @default - No managed scaling policy
   */
  readonly managedScalingPolicy?: ManagedScalingPolicy;
  /**
   * Override EMR Configurations.
   *
   * @default - the {@link catalog}'s configurations + .venv for the user code.
   */
  readonly configurations?: Configuration[];
  /**
   * @default {@link RemovalPolicy.DESTROY}
   */
  readonly removalPolicy?: RemovalPolicy;
  /**
   * @default - No bootstrap actions
   */
  readonly bootstrapActions?: BootstrapAction[];
  /**
   * The EMR Steps to submit to the cluster.
   *
   * @see https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark-submit-step.html
   */
  readonly steps?: Step[];
  /**
   * The concurrency level of the cluster.
   *
   * @default 1
   */
  readonly stepConcurrencyLevel?: number;
  /**
   * Extra java options to include in the Spark context by default.
   */
  readonly extraJavaOptions?: Record<string, string>;
  /**
   * Installs and configures the SSM agent to run on all Primary, Core and Task nodes.
   *
   * @default - `true` if {@link enableSSMTunnelOverSSH} is also `true`, otherwise `false`
   */
  readonly installSSMAgent?: boolean;
  /**
   * Install the GitHub CLI on the EMR cluster.
   *
   * @default false
   */
  readonly installGitHubCLI?: boolean;
  /**
   * Mount a shared filesystem to the EMR cluster
   */
  readonly home?: Workspace;
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

    const logsBucket = new Bucket(this, "ClusterLogs", {
      removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
    });

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
      logUri: `s3://${logsBucket.bucketName}/`,
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
        produce: () =>
          this.bootstrapActions.map(
            (action) =>
              ({
                name: action.name,
                scriptBootstrapAction: {
                  path: action.script.s3ObjectUrl,
                  args: action.args,
                },
              }) as CfnCluster.BootstrapActionConfigProperty,
          ),
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
          market: props.coreInstanceGroup?.market ?? Market.ON_DEMAND,
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
    logsBucket.grantReadWrite(this.jobFlowRole);
    Object.entries(props.catalogs).forEach(([catalogName, catalog]) =>
      catalog.bind(this, catalogName),
    );
    this.resource = cluster;
    cluster.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);

    if (props.installSSMAgent) {
      this.installSSMAgent();
    }
    if (props.installGitHubCLI) {
      this.installGitHubCLI();
    }
  }

  /**
   * Configure the EMR cluster start the Thrift Server and serve JDBC requests on the specified port.
   *
   * @param options to set when running the JDBC server
   * @returns a reference to the JDBC server
   * @example
   * const sparkSQL = cluster.jdbc({
   *  port: 10000,
   * });
   * sparkSQL.allowFrom(sageMakerDomain);
   */
  public jdbc(options: JdbcProps): Jdbc {
    return new Jdbc(this, options);
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
    action.script.grantRead(this.jobFlowRole);
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
    this.addBootstrapAction({
      name: "Install SSM Agent",
      script: this.getScript("install-ssm-agent.sh"),
    });
    // this allows the SSM agent to communicate with the SSM service
    this.jobFlowRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
    );
  }

  private isGitHubCLIInstalled: boolean | undefined;

  public installGitHubCLI() {
    if (this.isGitHubCLIInstalled) {
      return;
    }
    this.isGitHubCLIInstalled = false;
    this.addBootstrapAction({
      name: "Install GitHub CLI",
      script: this.getScript("install-github-cli.sh"),
    });
  }

  /**
   * Mount a {@link Home} directory onto the File System.
   *
   * @param home the home directory to mount
   */
  public mount(home: Home) {
    this.resource.node.addDependency(
      home.accessPoint.fileSystem.mountTargetsAvailable,
    );
    home.grantReadWrite(this.jobFlowRole);
    home.allowFrom(this.primarySg);
    home.allowFrom(this.coreSg);

    this.addMountBootstrapAction({
      target: home.accessPoint,
      mountPoint: home.path,
      username: home.username,
      uid: home.uid,
      gid: home.gid,
    });
  }

  /**
   * Mount an EFS Access Point on the EMR cluster.
   *
   * @param accessPoint the EFS Access Point to mount
   * @param options the options to use when mounting the Access Point
   */
  public mountAccessPoint(accessPoint: IAccessPoint, options: MountOptions) {
    this.grantMountPermissions(accessPoint.fileSystem, accessPoint);
    this.addMountBootstrapAction({
      target: accessPoint,
      mountPoint: options.mountPoint,
      username: options.username,
      uid: `${options.uid}`,
      gid: `${options.gid}`,
    });
  }

  /**
   * Mount an EFS File System on the EMR cluster.
   *
   * @param fileSystem the EFS File System to mount
   * @param options the options to use when mounting the File System
   */
  public mountFileSystem(fileSystem: IFileSystem, options: MountOptions) {
    this.grantMountPermissions(fileSystem);
    this.addMountBootstrapAction({
      target: fileSystem,
      mountPoint: options.mountPoint,
      username: options.username,
      uid: `${options.uid}`,
      gid: `${options.gid}`,
    });
  }

  private grantMountPermissions(
    fileSystem: IFileSystem,
    accessPoint?: IAccessPoint,
  ) {
    this.resource.node.addDependency(fileSystem.mountTargetsAvailable);
    this.jobFlowRole.addToPolicy(
      new PolicyStatement({
        actions: ["elasticfilesystem:DescribeMountTargets"],
        resources: [
          accessPoint?.fileSystem?.fileSystemArn,
          accessPoint?.accessPointArn,
        ].filter((s): s is string => !!s),
      }),
    );
    this.jobFlowRole.addToPolicy(
      new PolicyStatement({
        actions: [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
        ],
        resources: [fileSystem.fileSystemArn],
        conditions: {
          ...(accessPoint
            ? {
                StringEquals: {
                  "elasticfilesystem:AccessPointArn":
                    accessPoint.accessPointArn,
                },
              }
            : {}),
          Bool: {
            "elasticfilesystem:AccessedViaMountTarget": true,
          },
        },
      }),
    );
  }

  private addMountBootstrapAction({
    target,
    mountPoint,
    username,
    uid,
    gid,
  }: {
    target: IAccessPoint | IFileSystem;
    mountPoint: string;
    username: string;
    uid: string;
    gid: string;
  }) {
    const [fileSystemId, accessPointId] =
      "accessPointId" in target
        ? [target.fileSystem.fileSystemId, target.accessPointId]
        : [target.fileSystemId, undefined];
    this.addBootstrapAction({
      name: `Mount ${mountPoint}`,
      script: this.getScript("mount-efs.sh"),
      args: [
        "--file-system-id",
        fileSystemId,
        "--mount-point",
        mountPoint,
        ...(accessPointId ? ["--access-point-id", accessPointId] : []),
        "--user",
        username,
        "--uid",
        `${uid}`,
        "--gid",
        `${gid}`,
      ],
    });
  }

  private getScript(name: string) {
    const singletonId = `packyak::emr::${name}`;
    const stack = Stack.of(this);
    const bootstrapScript =
      (stack.node.tryFindChild(singletonId) as Asset) ??
      new Asset(stack, singletonId, {
        path: path.join(__dirname, "..", "..", "scripts", name),
      });
    return bootstrapScript;
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
