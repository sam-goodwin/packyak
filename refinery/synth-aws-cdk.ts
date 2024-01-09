import { Stack } from "aws-cdk-lib/core";
import {} from "aws-cdk-lib/aws-lambda";
import {} from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface RefineryProps {}

export class Refinery extends Construct {
  constructor(scope: Construct, id: string, props: RefineryProps) {
    super(scope, id);
  }
}
