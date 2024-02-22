import { IGrantable } from "aws-cdk-lib/aws-iam";

export interface IBindable extends IGrantable {
  addEnvironment(key: string, value: string): void;
}
