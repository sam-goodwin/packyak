export * from "./bind";
export * from "./dns-configuration";
export * from "./emr/bootstrap-action";
export * from "./emr/catalog";
export * from "./emr/cluster";
export * from "./emr/configuration";
export * from "./emr/glue-catalog";
export * from "./emr/jdbc";
export * from "./emr/market";
export * from "./emr/python-version";
export * from "./emr/release-label";
export * from "./emr/scala-version";
export * from "./emr/spark-version";
export * from "./emr/step";
export * from "./nessie/base-nessie-catalog";
// export * from "./nessie/nessie-config";
export * from "./nessie/nessie-ecs-catalog";
export * from "./nessie/nessie-lambda-catalog";
export * from "./nessie/nessie-version-store";
export * from "./python-poetry";
export * from "./sagemaker/domain";
export * from "./sagemaker/sage-maker-image";
export * from "./sagemaker/user-profile";
export * from "./streamlit-site";
export * from "./version";
export * from "./workspace/group";
export * from "./workspace/home";
export * from "./workspace/workspace";

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
