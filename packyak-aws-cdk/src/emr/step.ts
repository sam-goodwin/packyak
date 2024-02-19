import type { CfnCluster } from "aws-cdk-lib/aws-emr";

export interface Step extends CfnCluster.StepConfigProperty {}
