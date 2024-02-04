import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Bucket, EventType } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { execSync } from "child_process";
import { Construct } from "constructs";
import fs from "fs";
import path from "path";
import { FunctionSpec, ModuleSpec, PackyakSpec } from "../generated/spec.js";
import { exportRequirementsSync } from "./export-requirements.js";
import { Bindable } from "./bind.js";
import {
  S3EventSource,
  SqsEventSource,
} from "aws-cdk-lib/aws-lambda-event-sources";

export interface LakeHouseProps {
  /**
   * The name of this Lake House.
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

export class LakeHouse extends Construct {
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

  constructor(scope: Construct, id: string, props: LakeHouseProps) {
    super(scope, id);
    this.stage = props.stage;
    this.spec = analyzePackyakSync(props);
    const stack = Stack.of(this);

    const buckets = new Construct(this, "Buckets");
    const queues = new Construct(this, "Queues");
    const functions = new Construct(this, "Functions");

    this.buckets = this.spec.buckets.map(
      (bucketSpec) =>
        new Bucket(buckets, bucketSpec.bucket_id, {
          bucketName: `${bucketSpec.bucket_id}-${stack.account}-${stack.region}`,
          removalPolicy:
            props.stage === "prod" || props.stage === "dev"
              ? RemovalPolicy.RETAIN
              : RemovalPolicy.DESTROY,
        }),
    );
    this.queues = this.spec.queues.map(
      (queue) =>
        new Queue(queues, queue.queue_id, {
          queueName: `${queue.queue_id}`,
        }),
    );
    this.bucketIndex = Object.fromEntries(
      this.buckets.map((b) => [b.node.id, b]),
    );
    this.queueIndex = Object.fromEntries(
      this.queues.map((q) => [q.node.id, q]),
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
      exportRequirementsSync(indexFolder, funcSpec);

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
    return func(event, context)`,
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
      this.functions.map((f) => [f.node.id, f]),
    );

    for (const funcSpec of this.spec.functions) {
      const func = this.functionIndex[funcSpec.function_id];
      if (!func) {
        throw new Error(
          `Could not find function with id ${funcSpec.function_id}`,
        );
      }
      this.bind(func, funcSpec);
    }

    for (const bucketSpec of this.spec.buckets) {
      for (const sub of bucketSpec.subscriptions) {
        const func = this.functionIndex[sub.function_id];
        if (!func) {
          throw new Error(`Could not find function with id ${sub.function_id}`);
        }
        const bucket = this.bucketIndex[bucketSpec.bucket_id];
        if (!bucket) {
          throw new Error(
            `Could not find bucket with id ${bucketSpec.bucket_id}`,
          );
        }
        func.addEventSource(
          new S3EventSource(bucket, {
            events: sub.scopes.map((s) =>
              s === "create"
                ? EventType.OBJECT_CREATED
                : EventType.OBJECT_REMOVED,
            ),
          }),
        );
      }
    }

    for (const queueSpec of this.spec.queues) {
      for (const sub of queueSpec.subscriptions) {
        const func = this.functionIndex[sub.function_id];
        if (!func) {
          throw new Error(`Could not find function with id ${sub.function_id}`);
        }
        const queue = this.queueIndex[queueSpec.queue_id];
        if (!queue) {
          throw new Error(`Could not find queue with id ${queueSpec.queue_id}`);
        }
        func.addEventSource(
          new SqsEventSource(queue, {
            reportBatchItemFailures: true,
          }),
        );
      }
    }
  }

  public bind(
    target: Bindable,
    spec: ModuleSpec[] | FunctionSpec | ModuleSpec,
  ) {
    if (Array.isArray(spec)) {
      for (const module of spec) {
        this.bind(target, module);
      }
    } else if (spec.bindings) {
      for (const binding of spec.bindings) {
        if (binding.resource_type === "bucket") {
          const bucket = this.bucketIndex[binding.resource_id];
          if (!bucket) {
            throw new Error(
              `Could not find bucket with id ${binding.resource_id}`,
            );
          }
          const prefix = binding.props?.prefix;
          if (prefix !== undefined && typeof prefix !== "string") {
            throw new Error(
              `prefix must be a string, got ${JSON.stringify(prefix)}`,
            );
          }

          target.addEnvironment(
            `${binding.resource_id}_bucket_name`,
            bucket.bucketName,
          );
          if (binding.scopes.find((s) => s === "put")) {
            bucket.grantPut(target, prefix);
          } else if (binding.scopes.find((s) => s === "get" || s === "list")) {
            bucket.grantRead(target, prefix);
          } else if (binding.scopes.find((s) => s === "delete")) {
            bucket.grantDelete(target, prefix);
          }
        } else if (binding.resource_type === "queue") {
          const queue = this.queueIndex[binding.resource_id];
          if (!queue) {
            throw new Error(
              `Could not find queue with id ${binding.resource_id}`,
            );
          }
          target.addEnvironment(
            `${binding.resource_id}_queue_name`,
            queue.queueName,
          );
          target.addEnvironment(
            `${binding.resource_id}_queue_url`,
            queue.queueUrl,
          );
          if (binding.scopes.find((s) => s === "send")) {
            queue.grantSendMessages(target);
          } else if (binding.scopes.find((s) => s === "receive")) {
            queue.grantConsumeMessages(target);
          }
        } else if (binding.resource_type === "function") {
          const func = this.functionIndex[binding.resource_id];
          if (!func) {
            throw new Error(
              `Could not find function with id ${binding.resource_id}`,
            );
          }
          target.addEnvironment(
            `${binding.resource_id}_function_name`,
            func.functionName,
          );
          func.grantInvoke(target);
        }
      }
    }
  }
}

function analyzePackyakSync({ module }: LakeHouseProps): PackyakSpec {
  const cmd = `${findPythonSync()} -m packyak.synth --root=${module}`;
  execSync(cmd, {
    env: {
      PACKYAK_SYNTH: "true",
    },
  });
  const spec = JSON.parse(fs.readFileSync(".packyak/spec.json", "utf-8"));
  return spec;
}

function findPythonSync() {
  if (fs.existsSync(path.join(".venv", "bin", "python"))) {
    return ".venv/bin/python";
  } else if (fs.existsSync("pyproject.toml")) {
    return "poetry run python";
  }
  return "python";
}
