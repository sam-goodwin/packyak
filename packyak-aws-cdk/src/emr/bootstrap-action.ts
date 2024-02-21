import { CfnCluster } from "aws-cdk-lib/aws-emr";

export interface BootstrapAction
  extends CfnCluster.BootstrapActionConfigProperty {}
