import type { FileSystem } from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";
import { User, type UserProps } from "./user";

export interface UsersProps {
  /**
   * The EFS FileSystem that the users will be granted access to.
   */
  fileSystem: FileSystem;
}

export class Users extends Construct {
  /**
   * The EFS FileSystem that the users will be granted access to.
   */
  public readonly fileSystem: FileSystem;
  /**
   * The SSM user is the default user when connecting to a machine with AWS SSM.
   */
  public readonly ssmUser: User;

  constructor(scope: Construct, id: string, props: UsersProps) {
    super(scope, id);
    this.fileSystem = props.fileSystem;

    this.ssmUser = this.add({
      fileSystem: this.fileSystem,
      username: "ssm-user",
      uid: "1000",
      gid: "1000",
    });
  }

  public add(props: UserProps) {
    return new User(this, props.username, {
      ...props,
      fileSystem: this.fileSystem,
    });
  }
}
