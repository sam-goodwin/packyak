import { CustomResource, Duration } from "aws-cdk-lib";
import { Architecture, Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { Provider } from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

export interface PackYakResourceProps {
  resourceType: string;
  properties: Record<string, any>;
  code: Code;
  architecture?: Architecture;
  runtime?: Runtime;
  handler?: string;
  timeout?: Duration;
  environment?: Record<string, string>;
}

export class PackYakResource extends Function {
  constructor(scope: Construct, id: string, props: PackYakResourceProps) {
    super(scope, id, {
      code: props.code,
      architecture: props.architecture ?? Architecture.ARM_64,
      runtime: props.runtime ?? Runtime.NODEJS_20_X,
      handler: props.handler ?? "index.handler",
      timeout: props.timeout ?? Duration.minutes(1),
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
        ...props.environment,
      },
    });

    const provider = new Provider(this, "CreateUsers", {
      onEventHandler: this,
    });

    new CustomResource(this, "Users", {
      serviceToken: provider.serviceToken,
      resourceType: "Custom::CreateUsers",
      properties: props.properties,
    });
  }
}
