import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  AwsLogDriverMode,
  Cluster,
  ContainerImage,
  CpuArchitecture,
  LogDriver,
  OperatingSystemFamily,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps,
} from "aws-cdk-lib/aws-ecs-patterns";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import {
  BaseNessieService,
  BaseNessieServiceProps,
} from "./base-nessie-service";

export interface NessieECSServiceProps
  extends BaseNessieServiceProps,
    ApplicationLoadBalancedFargateServiceProps {
  serviceName: string;
  vpc?: IVpc;
  cluster?: Cluster;
  platform?: Platform;
}

export class NessieECSService extends BaseNessieService {
  public readonly service: ApplicationLoadBalancedFargateService;

  public override readonly serviceUrl: string;

  constructor(scope: Construct, id: string, props?: NessieECSServiceProps) {
    super(scope, id, props);

    const platform = props?.platform ?? Platform.LINUX_AMD64;

    const taskRole = new Role(this, "TaskRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cluster: props?.cluster,
      vpc: props?.vpc,
      serviceName: props?.serviceName,
      runtimePlatform: {
        cpuArchitecture:
          platform === Platform.LINUX_AMD64
            ? CpuArchitecture.X86_64
            : CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
      // this service should only be interacted with from within the VPC
      assignPublicIp: false,
      cpu: props?.cpu ?? 256,
      memoryLimitMiB: props?.memoryLimitMiB ?? 512,
      taskImageOptions: {
        ...(props?.taskImageOptions ?? {}),
        environment: {
          ...this.getConfigEnvVars(),
          ...props?.taskImageOptions?.environment,
        },
        containerPort: props?.taskImageOptions?.containerPort ?? 19120,
        taskRole,
        image:
          props?.taskImageOptions?.image ??
          ContainerImage.fromRegistry("ghcr.io/projectnessie/nessie"),
      },
    });

    this.service.targetGroup.configureHealthCheck({
      // uses smallrye-health:
      // see: https://redhat-developer-demos.github.io/quarkus-tutorial/quarkus-tutorial/health.html
      path: "/q/health",
    });

    this.serviceUrl = `https://${this.service.loadBalancer.loadBalancerDnsName}`;
  }
}
