export * from "./lakehouse.js";
export * from "./streamlit-site.js";
export * from "./sagemaker/domain.js";
export * from "./emr/spark-cluster.js";
export * from "./emr/glue-catalog.js";

import { CfnOutput, Stack } from "aws-cdk-lib/core";

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