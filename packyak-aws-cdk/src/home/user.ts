import { type FileSystem, AccessPoint } from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";

export interface UserProps {
  /**
   * The file system associated with the user.
   */
  readonly fileSystem: FileSystem;
  /**
   * The username for the user. This should be unique across all users.
   */
  readonly username: string;
  /**
   * The POSIX user ID for the user. This should be a unique identifier.
   */
  readonly uid: string;
  /**
   * The POSIX group ID for the user. This is used for file system permissions.
   */
  readonly gid: string;
}

export class User extends Construct {
  /**
   * The username of the user.
   *
   * Should match the AWS SSO username.
   */
  public readonly username: string;
  /**
   * An {@link AccessPoint} to the user's home directory
   */
  public readonly home: AccessPoint;
  /**
   * The POSIX user ID
   */
  public readonly uid: string;
  /**
   * The POSIX group ID
   */
  public readonly gid: string;

  constructor(scope: Construct, id: string, props: UserProps) {
    super(scope, id);

    this.username = props.username;
    this.uid = props.uid;
    this.gid = props.gid;

    this.home = new AccessPoint(this, "AccessPoint", {
      fileSystem: props.fileSystem,
      posixUser: {
        uid: props.uid,
        gid: props.gid,
      },
      path: `/home/${props.username}`,
    });
  }
}
