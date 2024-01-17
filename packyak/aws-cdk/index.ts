export * from "./lakehouse.js";
export * from "./streamlit-site.js";

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
