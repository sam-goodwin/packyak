import { Resource } from "aws-cdk-lib";
import { IRole } from "aws-cdk-lib/aws-iam";
import { CfnUserProfile } from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";
import { Domain } from "./domain.js";

export interface UserProfileProps {
  readonly domain: Domain;
  readonly userProfileName: string;
  readonly executionRole?: IRole;
}

export class UserProfile extends Resource {
  protected readonly resource: CfnUserProfile;
  constructor(scope: Construct, id: string, props: UserProfileProps) {
    super(scope, id);

    this.resource = new CfnUserProfile(this, "Resource", {
      domainId: props.domain.domainId,
      userProfileName: props.userProfileName,
      userSettings: {
        executionRole: props.executionRole?.roleArn,
      },
    });
  }
}
