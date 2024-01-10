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
import { YakkaSpec } from "./generated/spec";
import path from "path";

export interface YakkaProps {
  /**
   * Entrypoint to the streamlit application.
   *
   * @example "my/app.py"
   */
  entry: string;
}

export class Yakka extends Construct {
  readonly entry: string;
  readonly spec: YakkaSpec;

  constructor(scope: Construct, id: string, props: YakkaProps) {
    super(scope, id);
    this.entry = props.entry;
    this.spec = loadYakka(this.entry);

    this.buckets = this.spec.buckets.map(bucket => )
  }
}

function loadYakka(entry: string): YakkaSpec {
  let pythonCommand = "python";
  if (fs.existsSync(path.join(".venv", "bin", "python"))) {
    pythonCommand = ".venv/bin/python";
  } else if (fs.existsSync("pyproject.toml")) {
    pythonCommand = "poetry run python";
  }
  const cmd = `${pythonCommand} ${entry}`;
  console.log(cmd);
  execSync(cmd, {
    env: {
      YAKKA_SYNTH: "true",
    },
  });
  const spec = JSON.parse(fs.readFileSync(".yakka/spec.json", "utf-8"));
  return spec;
}

export interface StreamlitSiteProps
  extends ApplicationLoadBalancedTaskImageOptions {
  yakka: Yakka;
  /**
   * Entrypoint to the streamlit application.
   *
   * @example "my/app.py"
   */
  entry: string;
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
    // const yakka = loadYakka(props.entry);
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
