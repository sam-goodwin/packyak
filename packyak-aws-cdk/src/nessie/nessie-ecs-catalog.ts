import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  AwsLogDriver,
  ContainerImage,
  CpuArchitecture,
  OperatingSystemFamily,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps,
} from "aws-cdk-lib/aws-ecs-patterns";
import {
  IGrantable,
  IPrincipal,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { BaseNessieCatalog, BaseNessieRepoProps } from "./base-nessie-catalog";
import type { DNSConfiguration } from "../dns-configuration";
import { ILogGroup, LogGroup } from "aws-cdk-lib/aws-logs";

export interface NessieECSCatalogProps
  extends BaseNessieRepoProps,
    ApplicationLoadBalancedFargateServiceProps {
  readonly platform?: Platform;
  readonly dns?: DNSConfiguration;
}

export class NessieECSCatalog extends BaseNessieCatalog implements IGrantable {
  public readonly service: ApplicationLoadBalancedFargateService;

  public override readonly endpoint: string;

  public readonly grantPrincipal: IPrincipal;
  public readonly logGroup: ILogGroup;

  constructor(scope: Construct, id: string, props: NessieECSCatalogProps) {
    super(scope, id, props);

    const platform = props?.platform ?? Platform.LINUX_AMD64;

    const taskRole = new Role(this, "TaskRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // TODO: logs
    this.grantPrincipal = taskRole;

    this.logGroup =
      props.logGroup ??
      new LogGroup(this, "LogGroup", {
        logGroupName: `/nessie/${this.catalogName}`,
      });

    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cluster: props?.cluster,
      vpc: props.vpc,
      serviceName: props.serviceName,
      runtimePlatform: {
        cpuArchitecture:
          platform === Platform.LINUX_AMD64
            ? CpuArchitecture.X86_64
            : CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
      cpu: props?.cpu ?? 256,
      memoryLimitMiB: props?.memoryLimitMiB ?? 512,
      publicLoadBalancer: true,
      certificate: props?.dns?.certificate,
      domainName: props?.dns?.domainName,
      domainZone: props?.dns?.hostedZone,
      taskImageOptions: {
        ...(props?.taskImageOptions ?? {}),
        environment: {
          ...this.configAsEnvVars(),
          ...props?.taskImageOptions?.environment,
        },
        logDriver: AwsLogDriver.awsLogs({
          streamPrefix: "nessie",
          logGroup: this.logGroup,
        }),
        containerPort: props?.taskImageOptions?.containerPort ?? 19120,
        taskRole,
        image:
          props?.taskImageOptions?.image ??
          ContainerImage.fromRegistry("ghcr.io/projectnessie/nessie"),
      },
    });

    // this.service.loadBalancer.addListener("HTTPS", {
    //   port: 443,
    //   protocol: ApplicationProtocol.HTTPS,
    // });
    this.versionStore.grantReadWriteData(taskRole);

    this.service.targetGroup.configureHealthCheck({
      // uses smallrye-health:
      // see: https://redhat-developer-demos.github.io/quarkus-tutorial/quarkus-tutorial/health.html
      path: "/q/health",
    });

    if (props?.dns) {
      this.endpoint = `https://${props.dns.domainName}`;
    } else {
      this.endpoint = `http://${this.service.loadBalancer.loadBalancerDnsName}`;
    }
  }
}
