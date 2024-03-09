import {
  Connections,
  IConnectable,
  IVpc,
  Port,
  SecurityGroup,
  type InstanceType,
} from "aws-cdk-lib/aws-ec2";
import type { IAccessPoint, IFileSystem } from "aws-cdk-lib/aws-efs";
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
import { Bucket } from "aws-cdk-lib/aws-s3";
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
import { Home } from "../workspace/home";
import type { MountFileSystemOptions, Workspace } from "../workspace/workspace";
import { Application } from "./application";
import { BootstrapAction } from "./bootstrap-action";
import { ICatalog } from "./catalog";
import { Configuration, combineConfigurations } from "./configuration";
import type { FleetCluster } from "./fleet-cluster";
import {
  AllocationStrategy,
  InstanceFleet,
  TimeoutAction,
} from "./instance-fleet";
import type { InstanceGroup, PrimaryInstanceGroup } from "./instance-group";
import { InstanceMarket } from "./instance-market";
import { Jdbc, JdbcProps } from "./jdbc";
import { ManagedScalingPolicy, ScaleDownBehavior } from "./managed-scaling";
import { ReleaseLabel } from "./release-label";
import { toCLIArgs } from "./spark-config";
import { Step } from "./step";
import type { UniformCluster } from "./uniform-cluster";
import type { EbsBlockDevice } from "./block-device";

export interface BaseClusterProps {
  /**
   * Name of the EMR Cluster.
   */
  readonly clusterName: string;
  /**
   * The VPC to deploy the EMR cluster into.
   */
  readonly vpc: IVpc;
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
  readonly enableSSMAgent?: boolean;
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
  /**
   * By default, we enable GPU detection and registration with the YARN Node Manager.
   *
   * If disabled, you won't be able to provision GPU (P or G) EC2 instance types.
   *
   * @default true
   * @see https://hadoop.apache.org/docs/r3.1.0/hadoop-yarn/hadoop-yarn-site/UsingGpus.html
   */
  readonly enableGpuAcceleration?: boolean;
  /**
   * Enable the Spark Rapids plugin.
   *
   * @default false
   * @see https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark-rapids.html
   */
  readonly enableSparkRapids?: boolean;
  /**
   * Enable the XGBoost spark library.
   *
   * @default false
   * @see https://docs.nvidia.com/spark-rapids/user-guide/latest/getting-started/aws-emr.html
   */
  readonly enableXGBoost?: boolean;
  /**
   * Disable the bootstrap script that mounts cgroups and configures Yarn to use
   * them to isolate each container's resources.
   *
   * Can't be disabled if GPU support is enabled.
   *
   * @default false
   * @see https://hadoop.apache.org/docs/r3.1.0/hadoop-yarn/hadoop-yarn-site/UsingGpus.html
   */
  readonly disableYarnCGroups?: boolean;
  /**
   * Enable Docker support on the cluster.
   *
   * @default true
   */
  readonly enableDocker?: boolean;
}

export interface ClusterProps extends BaseClusterProps {
  /**
   * Describes the EC2 instances and instance configurations for the master
   * {@link InstanceGroup} when using {@link UniformCluster}s.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-masterinstancegroup
   */
  readonly primaryInstanceGroup?: PrimaryInstanceGroup;
  /**
   * Describes the EC2 instances and instance configurations for the master
   * {@link InstanceFleet} when using {@link FleetCluster}s.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-masterinstancefleet
   */
  readonly primaryInstanceFleet?: InstanceFleet;
  /**
   * Describes the EC2 instances and instance configurations for core
   * {@link InstanceGroup}s when using {@link UniformCluster}s.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-coreinstancegroup
   */
  readonly coreInstanceGroup?: InstanceGroup;
  /**
   * Describes the EC2 instances and instance configurations for the core {@link InstanceFleet} when
   * using {@link FleetCluster}s.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-coreinstancefleet
   */
  readonly coreInstanceFleet?: InstanceFleet;
  /**
   * Describes the EC2 instances and instance configurations for task {@link InstanceGroup}s
   * when using {@link UniformCluster}s.
   *
   * These task {@link InstanceGroup}s are added to the cluster as part of the cluster launch.
   * Each task {@link InstanceGroup} must have a unique name specified so that CloudFormation
   * can differentiate between the task {@link InstanceGroup}s.
   *
   * > After creating the cluster, you can only modify the mutable properties of `InstanceGroupConfig` , which are `AutoScalingPolicy` and `InstanceCount` . Modifying any other property results in cluster replacement.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-taskinstancegroups
   */
  readonly taskInstanceGroups?: InstanceGroup[];
  /**
   * Describes the EC2 instances and instance configurations for the task {@link InstanceFleet}s
   * when using {@link FleetCluster}s.
   *
   * These task {@link InstanceFleet}s are added to the cluster as part of the cluster launch.
   * Each task {@link InstanceFleet} must have a unique name specified so that CloudFormation
   * can differentiate between the task {@link InstanceFleet}s.
   *
   * > You can currently specify only one task instance fleet for a cluster. After creating the cluster, you can only modify the mutable properties of `InstanceFleetConfig` , which are `TargetOnDemandCapacity` and `TargetSpotCapacity` . Modifying any other property results in cluster replacement. > To allow a maximum of 30 Amazon EC2 instance types per fleet, include `TaskInstanceFleets` when you create your cluster. If you create your cluster without `TaskInstanceFleets` , Amazon EMR uses its default allocation strategy, which allows for a maximum of five Amazon EC2 instance types.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-taskinstancefleets
   */
  readonly taskInstanceFleets?: InstanceFleet[];
}

/**
 * An EMR Cluster.
 */
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

  protected readonly taskInstanceGroups: InstanceGroup[];
  protected readonly taskInstanceFleets: InstanceFleet[];

  protected readonly resource: CfnCluster;

  constructor(scope: Construct, id: string, props: ClusterProps) {
    super(scope, id);
    this.extraJavaOptions = { ...(props.extraJavaOptions ?? {}) };
    this.steps = [...(props.steps ?? [])];
    this.configurations = [...(props.configurations ?? [])];
    this.bootstrapActions = [...(props.bootstrapActions ?? [])];

    this.release = props.releaseLabel ?? ReleaseLabel.EMR_7_0_0;

    // const taskInstanceType = props.taskInstanceGroup?.instanceType ?? m5xlarge;
    this.taskInstanceGroups = [...(props.taskInstanceGroups ?? [])];
    this.taskInstanceFleets = [...(props.taskInstanceFleets ?? [])];

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
              resourceName: "*",
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

    const awsAccount = Stack.of(this).account;
    const awsRegion = Stack.of(this).region;
    const enableDocker = props.enableDocker ?? true;
    const enableGpuAcceleration = props.enableGpuAcceleration ?? true;
    const isUniformCluster =
      props.primaryInstanceGroup ||
      props.coreInstanceGroup ||
      props.taskInstanceGroups;
    const isFleetCluster =
      props.primaryInstanceFleet ||
      props.coreInstanceFleet ||
      props.taskInstanceFleets;

    if (isUniformCluster && isFleetCluster) {
      throw new Error(
        "Cannot specify both Instance Groups and Instance Fleets for Primary, Core and Task nodes. You must use either a UniformCluster or a FleetCluster.",
      );
    }

    if (props.disableYarnCGroups && enableGpuAcceleration) {
      throw new Error(
        "You cannot enable GPU support without also enabling YARN cgroups. Set `disableYarnCGroups: false` to re-enable YARN cgroups.",
      );
    }
    if (props.enableSparkRapids) {
      if (this.release.majorVersion < 6) {
        throw new Error(
          `The Spark Rapids plugin is not supported in EMR ${this.release.label}. You must >= 6.x`,
        );
      }
    }
    if (props.enableXGBoost && !props.enableSparkRapids) {
      throw new Error(
        "You cannot enable the XGBoost plugin without also enabling the Spark Rapids plugin.",
      );
    }
    if (enableGpuAcceleration) {
      if (this.release.majorVersion < 6) {
        throw new Error(
          // TODO: confirm that 5 is not supported
          `GPUs are not supported in EMR ${this.release.label}. You must >= 6.x`,
        );
      }
    }
    if (!props.disableYarnCGroups) {
      this.mountYarnCGroups();
    }
    if (enableDocker && enableGpuAcceleration) {
      this.installNVidiaContainerToolkit();
    }

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
        ec2SubnetId: isUniformCluster
          ? props.vpc.privateSubnets[0].subnetId
          : undefined,
        ec2SubnetIds: isFleetCluster
          ? props.vpc.privateSubnets.map((s) => s.subnetId)
          : undefined,

        emrManagedMasterSecurityGroup: this.primarySg.securityGroupId,
        emrManagedSlaveSecurityGroup: this.coreSg.securityGroupId,
        serviceAccessSecurityGroup: this.serviceAccessSg.securityGroupId,

        // Instance Scaling:
        masterInstanceGroup: props.primaryInstanceGroup
          ? this.getInstanceGroupConfig({
              ...props.primaryInstanceGroup,
              instanceCount: props.primaryInstanceGroup.instanceCount ?? 1,
              market:
                props.primaryInstanceGroup?.market ?? InstanceMarket.ON_DEMAND,
            })
          : undefined,
        masterInstanceFleet: props.primaryInstanceFleet
          ? this.getInstanceFleetConfig(props.primaryInstanceFleet)
          : undefined,
        coreInstanceGroup: props.coreInstanceGroup
          ? this.getInstanceGroupConfig({
              ...props.coreInstanceGroup,
              instanceCount: props.coreInstanceGroup.instanceCount ?? 1,
              market:
                props.coreInstanceGroup?.market ?? InstanceMarket.ON_DEMAND,
            })
          : undefined,
        coreInstanceFleet: props.coreInstanceFleet
          ? this.getInstanceFleetConfig(props.coreInstanceFleet)
          : undefined,
        taskInstanceGroups: Lazy.any({
          produce: () =>
            this.taskInstanceGroups.length > 0
              ? this.taskInstanceGroups.map((group) =>
                  this.getInstanceGroupConfig(group),
                )
              : undefined,
        }),
        taskInstanceFleets: Lazy.any({
          produce: () =>
            this.taskInstanceFleets.length > 0
              ? this.taskInstanceFleets?.map((fleet) =>
                  fleet ? this.getInstanceFleetConfig(fleet) : undefined,
                )
              : undefined,
        }),
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
                "spark.driver.extraJavaOptions": toCLIArgs(
                  this.extraJavaOptions,
                ),
              },
            },
            // this is in the docs for gpus, but seems like a best practice default config
            // -> use c-groups to isolate containers from each other
            {
              classification: "yarn-site",
              configurationProperties: {
                "yarn.node-labels.enabled": "true",
                "yarn.nodemanager.linux-container-executor.cgroups.mount":
                  "true",
                "yarn.nodemanager.linux-container-executor.cgroups.mount-path":
                  this.release.majorVersion === 7
                    ? // EMR 7
                      "/yarn-cgroup"
                    : // EMR 6
                      "/sys/fs/cgroup",
                "yarn.nodemanager.linux-container-executor.cgroups.hierarchy":
                  "yarn",
                "yarn.nodemanager.container-executor.class":
                  "org.apache.hadoop.yarn.server.nodemanager.LinuxContainerExecutor",
                ...(enableGpuAcceleration
                  ? {
                      "yarn.nodemanager.resource-plugins": "yarn.io/gpu",
                    }
                  : {}),
              },
            },
            {
              classification: "container-executor",
              configurationProperties: {},
              configurations: combineConfigurations([
                // required for device isolation of non-docker yarn containers
                {
                  classification: "cgroups",
                  configurationProperties: {
                    root:
                      this.release.majorVersion === 7
                        ? "/yarn-cgroup"
                        : // EMR 6
                          "/sys/fs/cgroup",
                    "yarn-hierarchy": "yarn",
                  },
                },
                enableDocker
                  ? {
                      // TODO: support more configuration
                      // see: https://hadoop.apache.org/docs/r3.1.1/hadoop-yarn/hadoop-yarn-site/DockerContainers.html
                      classification: "docker",
                      configurationProperties: {
                        // by default, trust all container registries in the account/region pair
                        "docker.privileged-containers.registries": `local,${awsAccount}.dkr.ecr.${awsRegion}.amazonaws.com`,
                        "docker.trusted.registries": `local,${awsAccount}.dkr.ecr.${awsRegion}.amazonaws.com`,
                        ...(enableGpuAcceleration
                          ? {
                              "docker.allowed.runtimes": "nvidia",
                            }
                          : {}),
                      },
                    }
                  : undefined,
              ]),
            },
            enableGpuAcceleration
              ? [
                  {
                    classification: "yarn-site",
                    configurationProperties: {
                      "yarn.resource-types": "yarn.io/gpu",
                    },
                  },
                  {
                    classification: "capacity-scheduler",
                    configurationProperties: {
                      "yarn.scheduler.capacity.resource-calculator":
                        "org.apache.hadoop.yarn.util.resource.DominantResourceCalculator",
                    },
                  },
                  {
                    classification: "container-executor",
                    configurationProperties: {},
                    configurations: [
                      {
                        classification: "gpu",
                        configurationProperties: {
                          "module.enabled": "true",
                        },
                      },
                    ],
                  },
                ]
              : undefined,
            // @see https://docs.aws.amazon.com/emr/latest/ReleaseGuide/emr-spark-rapids.html
            props.enableSparkRapids
              ? [
                  {
                    classification: "spark",
                    configurationProperties: {
                      enableSparkRapids: "true",
                    },
                  },
                  {
                    classification: "spark-defaults",
                    configurationProperties: {
                      "spark.plugins": "com.nvidia.spark.SQLPlugin",
                      "spark.executor.resource.gpu.discoveryScript":
                        "/usr/lib/spark/scripts/gpu/getGpusResources.sh",
                      "spark.executor.extraLibraryPath":
                        "/usr/local/cuda/targets/x86_64-linux/lib:/usr/local/cuda/extras/CUPTI/lib64:/usr/local/cuda/compat/lib:/usr/local/cuda/lib:/usr/local/cuda/lib64:/usr/lib/hadoop/lib/native:/usr/lib/hadoop-lzo/lib/native:/docker/usr/lib/hadoop/lib/native:/docker/usr/lib/hadoop-lzo/lib/native",
                    },
                  },
                ]
              : undefined,
            // @see https://docs.nvidia.com/spark-rapids/user-guide/latest/getting-started/aws-emr.html#submit-spark-jobs-to-an-emr-cluster-accelerated-by-gpus
            props.enableXGBoost
              ? {
                  classification: "spark-defaults",
                  configurationProperties: {
                    "spark.submit.pyFiles":
                      // note: spark_3.0 is used for all spark versions on EMR right now
                      "/usr/lib/spark/jars/xgboost4j-spark_3.0-1.4.2-0.3.0.jar",
                  },
                }
              : undefined,
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
    for (const [catalogName, catalog] of Object.entries(props.catalogs)) {
      catalog.bind(this, catalogName);
    }
    this.resource = cluster;
    cluster.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);

    if (props.enableSSMAgent) {
      this.enableSSMAgent();
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

  private getInstanceGroupConfig(
    instanceGroup: InstanceGroup,
  ): CfnCluster.InstanceGroupConfigProperty {
    return {
      instanceCount: instanceGroup.instanceCount,
      instanceType: instanceGroup.instanceType.toString(),
      customAmiId: instanceGroup.customAmi?.getImage(this).imageId,
      market: instanceGroup.market,
      configurations: combineConfigurations(
        instanceGroup.configurations,
        this.getInstanceConfigurations(instanceGroup.instanceType),
      ),
      ebsConfiguration: this.getEbsConfigurations(instanceGroup),
      bidPrice: instanceGroup.bidPrice,
      autoScalingPolicy: instanceGroup.autoScalingPolicy,
    };
  }

  private getInstanceFleetConfig(
    instanceFleet: InstanceFleet,
  ): CfnCluster.InstanceFleetConfigProperty {
    const timeoutDuration = instanceFleet.timeoutDuration?.toMinutes() ?? 60;
    if (timeoutDuration < 5 || timeoutDuration > 1440) {
      throw new Error("timeoutDuration must be between 5 and 1440 minutes");
    }
    // check timeoutDuration is a whole minute
    if (timeoutDuration % 1 !== 0) {
      throw new Error("timeoutDuration must be a whole number of minutes");
    }
    const targetOnDemandCapacity = instanceFleet.targetOnDemandCapacity ?? 0;
    const targetSpotCapacity = instanceFleet.targetSpotCapacity ?? 0;

    if (targetOnDemandCapacity + targetSpotCapacity == 0) {
      throw new Error(
        "targetOnDemandCapacity and targetSpotCapacity cannot both be 0",
      );
    }

    return {
      name: instanceFleet.name,
      targetOnDemandCapacity: instanceFleet?.targetOnDemandCapacity,
      targetSpotCapacity: instanceFleet?.targetSpotCapacity,
      launchSpecifications: {
        onDemandSpecification: {
          allocationStrategy: AllocationStrategy.LOWEST_PRICE,
        },
        spotSpecification: {
          // deprecated by AWS
          // blockDurationMinutes: ,
          timeoutAction:
            instanceFleet?.timeoutAction ?? TimeoutAction.SWITCH_TO_ON_DEMAND,
          timeoutDurationMinutes: timeoutDuration,
          allocationStrategy:
            instanceFleet?.allocationStrategy ??
            AllocationStrategy.LOWEST_PRICE,
        },
      },
      instanceTypeConfigs: instanceFleet.instanceTypes.map(
        (instance) =>
          ({
            customAmiId: instance.customAmi?.getImage(this).imageId,
            instanceType: instance.instanceType.toString(),
            weightedCapacity: instance.weightedCapacity,
            bidPriceAsPercentageOfOnDemandPrice:
              instance.bidPriceAsPercentageOfOnDemandPrice,
            bidPrice: instance.bidPrice,
            ebsConfiguration: this.getEbsConfigurations(instance),
            configurations: combineConfigurations(
              ...(instance.configurations ?? []),
              ...(this.getInstanceConfigurations(instance.instanceType) ?? []),
            ),
          }) satisfies CfnCluster.InstanceTypeConfigProperty,
      ),
    };
  }

  private getInstanceConfigurations(
    instance: InstanceType,
  ): Configuration[] | undefined {
    const instanceType = instance.toString().toLocaleLowerCase();
    const isGpuInstance =
      instanceType.startsWith("p") || instanceType.startsWith("g");
    if (isGpuInstance) {
      return [
        {
          classification: "yarn-site",
          configurationProperties: {
            "yarn.nodemanager.resource-plugins.gpu.allowed-gpu-devices": "auto",
            "yarn.nodemanager.resource-plugins.gpu.path-to-discovery-executables":
              "/usr/bin",
          },
        },
      ];
      // TODO:
    }
    return undefined;
  }

  private getEbsConfigurations(instance: {
    readonly ebsBlockDevices?: EbsBlockDevice[];
    readonly ebsOptimized?: boolean;
  }) {
    return {
      // TODO: is there a good reason not to use this?
      ebsOptimized: instance.ebsOptimized ?? true,
      ebsBlockDeviceConfigs: instance.ebsBlockDevices
        ? instance.ebsBlockDevices.map(
            (device) =>
              ({
                volumeSpecification: {
                  sizeInGb: device.sizeInGb,
                  volumeType: device.volumeType,
                  iops: device.iops,
                  throughput: device.throughput,
                },
                volumesPerInstance: device.volumesPerInstance ?? 1,
              }) satisfies CfnCluster.EbsBlockDeviceConfigProperty,
          )
        : undefined,
    };
  }

  /**
   * Installs the SSM Agent on Primary, Core, and Task nodes.
   *
   * Authorizes the EC2 instances to communicate with the SSM service.
   *
   * @see https://aws.amazon.com/blogs/big-data/securing-access-to-emr-clusters-using-aws-systems-manager/
   */
  public enableSSMAgent() {
    // this allows the SSM agent to communicate with the SSM service
    this.jobFlowRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
    );
  }

  private isYarnCGroupsMounted: boolean | undefined;

  /**
   * Mounts YARN cgroups if not already mounted.
   */
  public mountYarnCGroups() {
    if (this.isYarnCGroupsMounted) {
      return;
    }
    this.isYarnCGroupsMounted = true;
    this.addBootstrapAction({
      name: "Mount Yarn cgroups",
      script: this.getScript("mount-yarn-cgroups.sh"),
      args: ["--emr-version", this.release.majorVersion.toString()],
    });
  }

  private isNVidiaContainerInstalled: boolean | undefined;

  /**
   * Install the NVidia Container Toolkit, register it with Docker and restart the Daemon.
   */
  public installNVidiaContainerToolkit() {
    if (this.isNVidiaContainerInstalled) {
      return;
    }
    this.isNVidiaContainerInstalled = true;
    this.addBootstrapAction({
      name: "Install NVIDIA Container Toolkit",
      script: this.getScript("install-nvidia-container-toolkit.sh"),
    });
  }

  private isGitHubCLIInstalled: boolean | undefined;

  /**
   * Install the GitHub CLI on the EMR cluster.
   */
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
  public mountAccessPoint(
    accessPoint: IAccessPoint,
    options: MountFileSystemOptions,
  ) {
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
  public mountFileSystem(
    fileSystem: IFileSystem,
    options: MountFileSystemOptions,
  ) {
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
