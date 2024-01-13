import fs from "fs";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargatePlatformVersion,
  HealthCheck,
  OperatingSystemFamily,
  RuntimePlatform,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps,
} from "aws-cdk-lib/aws-ecs-patterns";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { exec, execSync } from "child_process";
import { Construct } from "constructs";
import {
  DependencyGroup,
  PackyakSpec,
  PythonPoetryArgs,
} from "./generated/spec.js";
import path from "path";
import { Stack, CfnOutput, RemovalPolicy, IgnoreMode } from "aws-cdk-lib/core";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

declare module "aws-cdk-lib/core" {
  interface Stack {
    addOutputs(outputs: Record<string, string>): void;
  }
}

Stack.prototype.addOutputs = function (outputs: Record<string, string>) {
  for (const [key, value] of Object.entries(outputs)) {
    new CfnOutput(this, key, { value });
  }
};

export interface DataLakeProps {
  /**
   * The name of this Data Lake.
   *
   * @default - the Construct's id, e.g. new DateLake(this, id)
   */
  name: string;
  /**
   * The stage of the deployment.
   *
   * @example  "prod", "dev", "sam-personal"
   */
  stage: string;
  /**
   * Source directory for the Packyak application.
   */
  module: string;
  /**
   * The VPC to deploy the Packyak resources in to.
   *
   * @default - A new VPC is created.
   */
  vpc?: IVpc;
  /**
   * Number of NAT gateways to configure
   *
   * @default 1
   */
  natGateways?: number;
}

export class DataLake extends Construct {
  readonly stage: string;
  readonly spec: PackyakSpec;
  readonly vpc: IVpc;
  readonly cluster: Cluster;
  readonly buckets: Bucket[];
  readonly queues: Queue[];
  readonly bucketIndex: {
    [bucket_id: string]: Bucket;
  };
  readonly queueIndex: {
    [queue_id: string]: Queue;
  };
  readonly functions: PythonFunction[];
  readonly functionIndex: {
    [function_id: string]: PythonFunction;
  };

  constructor(scope: Construct, id: string, props: DataLakeProps) {
    super(scope, id);
    this.stage = props.stage;
    this.spec = loadPackyak(props);
    const stack = Stack.of(this);

    const buckets = new Construct(this, "Buckets");
    const queues = new Construct(this, "Queues");
    const functions = new Construct(this, "Functions");

    this.buckets = this.spec.buckets.map(
      (bucket) =>
        new Bucket(buckets, bucket.bucket_id, {
          bucketName: `${bucket.bucket_id}-${stack.account}-${stack.region}`,
          removalPolicy:
            props.stage === "prod" || props.stage === "dev"
              ? RemovalPolicy.RETAIN
              : RemovalPolicy.DESTROY,
        })
    );
    this.queues = this.spec.queues.map(
      (queue) =>
        new Queue(queues, queue.queue_id, {
          queueName: `${queue.queue_id}`,
        })
    );
    this.bucketIndex = Object.fromEntries(
      this.buckets.map((b) => [b.bucketName, b])
    );
    this.queueIndex = Object.fromEntries(
      this.queues.map((q) => [q.queueName, q])
    );
    this.vpc =
      props.vpc ??
      new Vpc(this, "Vpc", {
        natGateways: props.natGateways ?? 1,
      });
    this.cluster = new Cluster(this, "Cluster");
    this.functions = this.spec.functions.map((funcSpec) => {
      const indexFolder = path.join(".packyak", funcSpec.function_id);
      const index = path.join(indexFolder, "index.py");
      if (fs.existsSync(indexFolder)) {
        fs.rmSync(indexFolder, { recursive: true });
      }
      fs.mkdirSync(indexFolder, { recursive: true });
      exportRequirements(indexFolder, funcSpec);

      const mod = path
        .relative(process.cwd(), funcSpec.file_name)
        .replace(".py", "")
        .replaceAll("/", ".");
      fs.writeFileSync(
        index,
        `from typing import Any
from packyak import lookup_function

# import the @function() decorated function
import ${mod}

func = lookup_function("${funcSpec.function_id}")

def handle(event: Any, context: Any):
    return func(event, context)`
      );
      const functionName = `${props.name}-${props.stage}-${funcSpec.function_id}`;
      return new PythonFunction(functions, funcSpec.function_id, {
        functionName:
          functionName.length > 64
            ? // TODO: better truncation method, AWS Lambda only support functions with 64 characters
              undefined
            : functionName,
        entry: indexFolder,
        index: "index.py",
        handler: "handle",
        runtime: Runtime.PYTHON_3_12,
        vpc: this.vpc,
      });
    });
    this.functionIndex = Object.fromEntries(
      this.functions.map((f) => [f.functionName, f])
    );
  }
}

function exportRequirements(dir: string, options?: PythonPoetryArgs) {
  const command = [
    "poetry export -f requirements.txt",
    arg("with", options?.with),
    arg("without", options?.without),
    arg("without-urls", options?.without_urls),
    arg("without-hashes", options?.without_hashes ?? true),
    arg("dev", options?.dev),
    arg("all-extras", options?.all_extras),
    `> ${dir}/requirements.txt`,
  ];

  execSync(command.join(" "));

  function arg<T extends string[] | string | boolean | number>(
    flag: string,
    value: T | undefined
  ) {
    if (value === undefined) {
      return "";
    } else if (typeof value === "boolean") {
      return value ? ` --${flag}` : "";
    } else {
      return ` --${flag}=${Array.isArray(value) ? value.join(",") : value}`;
    }
  }
}

function loadPackyak({ module }: DataLakeProps): PackyakSpec {
  const cmd = `${findPython()} -m ${module}`;
  execSync(cmd, {
    env: {
      PACKYAK_SYNTH: "true",
    },
  });
  const spec = JSON.parse(fs.readFileSync(".packyak/spec.json", "utf-8"));
  return spec;
}

function findPython() {
  if (fs.existsSync(path.join(".venv", "bin", "python"))) {
    return ".venv/bin/python";
  } else if (fs.existsSync("pyproject.toml")) {
    return "poetry run python";
  }
  return "python";
}

export interface StreamlitSiteProps
  extends ApplicationLoadBalancedFargateServiceProps {
  /**
   * The {@link DataLake} that this Streamlit application will use.
   */
  readonly dataLake: DataLake;
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
}

export class StreamlitSite extends Construct {
  readonly service;
  readonly url;

  constructor(scope: Construct, id: string, props: StreamlitSiteProps) {
    super(scope, id);

    exportRequirements(".packyak");

    const platform = props.platform ?? Platform.LINUX_AMD64;

    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cpu: 256,
      memoryLimitMiB: 512,
      cluster: props.dataLake.cluster,
      runtimePlatform: {
        cpuArchitecture:
          platform === Platform.LINUX_AMD64
            ? CpuArchitecture.X86_64
            : CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX,
      },
      ...props,
      taskImageOptions: {
        containerPort: 8501,
        image:
          props.taskImageOptions?.image ??
          ContainerImage.fromAsset(".", {
            ignoreMode: IgnoreMode.DOCKER,
            platform,
          }),
        ...(props.taskImageOptions ?? {}),
      },
    });
    this.service.targetGroup.configureHealthCheck(
      props.healthCheck ?? {
        path: "/_stcore/health",
      }
    );

    this.url = `https://${this.service.loadBalancer.loadBalancerDnsName}`;
  }
}
