import fs from "fs";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage } from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps,
} from "aws-cdk-lib/aws-ecs-patterns";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { execSync } from "child_process";
import { Construct } from "constructs";
import { PackyakSpec } from "./generated/spec";
import path from "path";
import { type App, Stack, CfnOutput } from "aws-cdk-lib/core";
import { Queue } from "aws-cdk-lib/aws-sqs";

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
   *
   */
  src: string;
  /**
   * Entrypoint to the streamlit application.
   *
   * @example {@link src}/__init__.py
   */
  entry?: string;
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

  // readonly functions: Function[];

  constructor(scope: Construct, id: string, props: DataLakeProps) {
    super(scope, id);

    this.spec = loadPackyak(props);
    const stack = Stack.of(this);
    this.buckets = this.spec.buckets.map(
      (bucket) =>
        new Bucket(this, bucket.bucket_id, {
          bucketName: `${bucket.bucket_id}-${stack.account}-${stack.region}`,
        })
    );
    this.queues = this.spec.queues.map(
      (queue) =>
        new Queue(this, queue.queue_id, {
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
    this.cluster = new Cluster(this, "Cluster", {});
    // this.functions = this.spec.functions.map((funcSpec) => {
    //   return new Function(this, funcSpec.function_id, {
    //     code: Code.fromAsset(funcSpec.file_name),
    //     // @ts-expect-error - TODO
    //     handler: funcSpec.handler,
    //     runtime: Runtime.PYTHON_3_8,
    //     environment: {
    //       PACKYAK_SYNTH: "true",
    //     },
    //   });
    // });
  }
}

function loadPackyak({ src, entry }: DataLakeProps): PackyakSpec {
  let pythonCommand = "python";
  if (fs.existsSync(path.join(".venv", "bin", "python"))) {
    pythonCommand = ".venv/bin/python";
  } else if (fs.existsSync("pyproject.toml")) {
    pythonCommand = "poetry run python";
  }
  const cmd = `${pythonCommand} ${entry}`;
  execSync(cmd, {
    env: {
      PACKYAK_SYNTH: "true",
    },
  });
  const spec = JSON.parse(fs.readFileSync(".packyak/spec.json", "utf-8"));
  return spec;
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
}

export class StreamlitSite extends Construct {
  readonly service;
  readonly url;

  constructor(scope: Construct, id: string, props: StreamlitSiteProps) {
    super(scope, id);

    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cpu: 256,
      cluster: props.dataLake.cluster,
      ...props,
      taskImageOptions: {
        image: ContainerImage.fromRegistry("python:3.12-slim"),
        ...(props.taskImageOptions ?? {}),
      },
    });

    this.url = `https://${this.service.loadBalancer.loadBalancerDnsName}`;
  }
}
