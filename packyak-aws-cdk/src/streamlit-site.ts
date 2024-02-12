import { IgnoreMode } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  ContainerImage,
  CpuArchitecture,
  OperatingSystemFamily,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps,
} from "aws-cdk-lib/aws-ecs-patterns";
import { HealthCheck } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import type { PythonPoetryArgs } from "./generated/spec.js";
import { exportRequirementsSync } from "./export-requirements";
import type { LakeHouse } from "./lakehouse";
import path from "path";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

export interface StreamlitSiteProps
  extends ApplicationLoadBalancedFargateServiceProps {
  /**
   * The {@link LakeHouse} that this Streamlit application will source and contribute data to.
   */
  readonly lakeHouse: LakeHouse;
  /**
   * Entrypoint to the streamlit application.
   *
   * @example "my/app.py"
   */
  readonly home: string;
  /**
   * The name of the Dockerfile to use to build this Streamlit site.
   *
   * @default "Dockerfile"
   */
  readonly dockerfile?: string;
  /**
   * The platform to use to build this Streamlit site.
   *
   * @default {@link Platform.LINUX_AMD64}
   */
  readonly platform?: Platform;
  /**
   * Override the {@link HealthCheck} for this Streamlit site.
   *
   * @default /_stcore/health
   * @see https://docs.streamlit.io/knowledge-base/tutorials/deploy/docker
   */
  readonly healthCheck?: HealthCheck;
  /**
   * Override how the `requirements.txt` file is generated with Python Poetry
   *
   * @default - see {@link exportRequirementsSync}
   */
  readonly pythonPoetryArgs?: PythonPoetryArgs;
}

export class StreamlitSite extends Construct {
  readonly service;
  readonly url;

  constructor(scope: Construct, id: string, props: StreamlitSiteProps) {
    super(scope, id);

    const requirementsPath = exportRequirementsSync(
      path.join(".packyak", this.node.addr),
      props.pythonPoetryArgs,
    );

    // enumerate over the module specs to discover what the home and pages/*.py depend on
    const homeFilePath = path.resolve(props.home);
    const pagesDirPath = path.join(path.dirname(homeFilePath), "pages");

    const homeAndPagesModules = props.lakeHouse.spec.modules.flatMap((module) =>
      module.file_name === homeFilePath ||
      module.file_name.startsWith(path.join(pagesDirPath, ""))
        ? [module]
        : [],
    );

    const platform = props.platform ?? Platform.LINUX_AMD64;

    const taskRole =
      props.taskImageOptions?.taskRole ??
      new Role(this, "TaskRole", {
        assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
      });
    const environment: Record<string, string> = {
      ...props.taskImageOptions?.environment,
    };
    props.lakeHouse.bind(
      {
        grantPrincipal: taskRole,
        addEnvironment: (key, value) => {
          environment[key] = value;
        },
      },
      homeAndPagesModules,
    );

    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      ...props,
      cluster: props.lakeHouse.cluster,
      runtimePlatform: {
        cpuArchitecture:
          platform === Platform.LINUX_AMD64
            ? CpuArchitecture.X86_64
            : CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
      cpu: props.cpu ?? 256,
      memoryLimitMiB: props.memoryLimitMiB ?? 512,
      taskImageOptions: {
        ...(props.taskImageOptions ?? {}),
        environment,
        containerPort: props.taskImageOptions?.containerPort ?? 8501,
        taskRole,
        image:
          props.taskImageOptions?.image ??
          ContainerImage.fromAsset(".", {
            ignoreMode: IgnoreMode.DOCKER,
            platform,
            buildArgs: {
              REQUIREMENTS_PATH: requirementsPath,
            },
          }),
      },
    });

    this.service.targetGroup.configureHealthCheck(
      props.healthCheck ?? {
        path: "/_stcore/health",
      },
    );

    this.url = `https://${this.service.loadBalancer.loadBalancerDnsName}`;
  }
}
