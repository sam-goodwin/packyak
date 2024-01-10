import fs from "fs";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedTaskImageOptions,
} from "aws-cdk-lib/aws-ecs-patterns";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { execSync } from "child_process";
import { Construct } from "constructs";
import { PackyakSpec } from "./generated/spec";
import path from "path";
import { Stack } from "aws-cdk-lib/core";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";

export interface PackyakProps {
  /**
   * Entrypoint to the streamlit application.
   *
   * @example "my/app.py"
   */
  entry: string;
}

export class Packyak extends Construct {
  readonly spec: PackyakSpec;
  readonly buckets: Bucket[];
  readonly queues: Queue[];
  readonly bucketIndex: {
    [bucket_id: string]: Bucket;
  };
  readonly queueIndex: {
    [queue_id: string]: Queue;
  };
  // readonly functions: Function[];

  constructor(scope: Construct, id: string, props: PackyakProps) {
    super(scope, id);
    this.spec = loadPackyak(props.entry);
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

function loadPackyak(entry: string): PackyakSpec {
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
  extends ApplicationLoadBalancedTaskImageOptions {
  packyak: Packyak;
  /**
   * Entrypoint to the streamlit application.
   *
   * @example "my/app.py"
   */
  home: string;
  /**
   * The VPC to deploy the streamlit application into.
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

export class StreamlitSite extends Construct {
  readonly vpc;
  readonly state;
  readonly cluster;
  readonly service;

  constructor(scope: Construct, id: string, props: StreamlitSiteProps) {
    super(scope, id);
    // const packyak = loadPackyak(props.entry);
    this.vpc =
      props.vpc ??
      new Vpc(this, "Vpc", {
        natGateways: props.natGateways ?? 1,
      });
    this.state = new Bucket(this, "State");
    this.cluster = new Cluster(this, "Cluster", {});
    this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cpu: 256,
      cluster: this.cluster,
      taskImageOptions: {
        image: props.image,
      },
    });
  }
}
