import { Construct } from "constructs";
import {
  Cluster,
  ContainerImage,
  TaskDefinition,
  Compatibility,
  Ec2Service,
  FargateService,
} from "aws-cdk-lib/aws-ecs";
import { IVpc, Vpc, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { Role, ServicePrincipal, ManagedPolicy } from "aws-cdk-lib/aws-iam";

export interface RayClusterProps {
  /**
   * The VPC to deploy the Ray cluster to. If not provided, a new VPC is created.
   */
  readonly vpc?: IVpc;
  /**
   * The ECS cluster to deploy the Ray cluster to. If not provided, a new cluster is created in the provided VPC.
   */
  readonly cluster?: Cluster;
  /**
   * The Docker image for the Ray nodes.
   */
  readonly image: string;
  /**
   * The number of worker nodes for the Ray cluster.
   */
  readonly workerCount: number;
}

/**
 * Represents a Ray cluster deployment in AWS, encapsulating the necessary AWS resources.
 */
export class RayCluster extends Construct {
  /**
   * The VPC where the Ray cluster is deployed.
   */
  public readonly vpc: IVpc;

  /**
   * The ECS cluster where the Ray cluster is deployed.
   */
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: RayClusterProps) {
    super(scope, id);

    this.vpc = props.vpc ?? new Vpc(this, "RayVpc");
    this.cluster =
      props.cluster ?? new Cluster(this, "RayCluster", { vpc: this.vpc });

    // Create a task definition for the Ray head node
    const headTaskDef = new TaskDefinition(this, "RayHeadTask", {
      compatibility: Compatibility.FARGATE,
      cpu: "256",
      memoryMiB: "512",
    });

    headTaskDef.addContainer("RayHeadContainer", {
      image: ContainerImage.fromRegistry(props.image),
      cpu: 256,
      memoryLimitMiB: 512,
      environment: {
        RAY_HEAD: "true",
      },
    });

    // Create a task definition for the Ray worker nodes
    const workerTaskDef = new TaskDefinition(this, "RayWorkerTask", {
      compatibility: Compatibility.FARGATE,
      cpu: "256",
      memoryMiB: "512",
    });

    workerTaskDef.addContainer("RayWorkerContainer", {
      image: ContainerImage.fromRegistry(props.image),
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // Create a security group for the Ray cluster
    const securityGroup = new SecurityGroup(this, "RayClusterSG", {
      vpc: this.vpc,
    });

    // Create an IAM role for the ECS tasks
    const taskRole = new Role(this, "RayTaskRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy",
      ),
    );

    // Deploy the Ray head node as a Fargate service
    const headService = new FargateService(this, "RayHeadService", {
      cluster: this.cluster,
      taskDefinition: headTaskDef,
      securityGroups: [securityGroup],
    });

    // Deploy the Ray worker nodes as Fargate services
    for (let i = 0; i < props.workerCount; i++) {
      new FargateService(this, `RayWorkerService${i}`, {
        cluster: this.cluster,
        taskDefinition: workerTaskDef,
        securityGroups: [securityGroup],
      });
    }
  }
}
