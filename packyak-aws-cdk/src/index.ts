export * from "./bind.js";
export * from "./dns-configuration.js";
export * from "./emr/bootstrap-action.js";
export * from "./emr/catalog.js";
export * from "./emr/cluster.js";
export * from "./emr/configuration.js";
export * from "./emr/glue-catalog.js";
export * from "./emr/jdbc.js";
export * from "./emr/market.js";
export * from "./emr/python-version.js";
export * from "./emr/release-label.js";
export * from "./emr/scala-version.js";
export * from "./emr/spark-version.js";
export * from "./emr/step.js";
export * from "./nessie/base-nessie-catalog.js";
// export * from "./nessie/nessie-config.js";
export * from "./nessie/nessie-ecs-catalog.js";
export * from "./nessie/nessie-lambda-catalog.js";
export * from "./nessie/nessie-version-store.js";
export * from "./python-poetry.js";
export * from "./sagemaker/domain.js";
export * from "./sagemaker/sage-maker-image.js";
export * from "./sagemaker/user-profile.js";
export * from "./streamlit-site.js";
export * from "./version.js";
export * from "./home/home.js";
export * from "./home/user.js";
export * from "./home/users.js";

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
