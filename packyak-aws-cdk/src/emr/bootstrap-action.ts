import type { Asset } from "aws-cdk-lib/aws-s3-assets";

export interface BootstrapAction {
  readonly name: string;
  readonly script: Asset;
  readonly args?: string[];
}
