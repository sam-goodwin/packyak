import { IGrantable } from "aws-cdk-lib/aws-iam";

export interface Bindable extends IGrantable {
  addEnvironment(key: string, value: string): void;
}
