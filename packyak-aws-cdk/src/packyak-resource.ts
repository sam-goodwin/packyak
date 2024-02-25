import { Duration, CustomResource } from "aws-cdk-lib";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunctionProps,
  NodejsFunction,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import * as path from "path";

export interface PackYakResourceProps extends NodejsFunctionProps {
  resourceType: string;
  properties: Record<string, any>;
}

export class PackYakResource extends NodejsFunction {
  constructor(scope: Construct, id: string, props: PackYakResourceProps) {
    super(scope, id, {
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, "delete-domain"),
      handler: "index.handler",
      timeout: Duration.minutes(1),
      environment: {
        NODE_OPTIONS: "--experimental-modules=true",
        ...props.environment,
      },
      ...props,
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
