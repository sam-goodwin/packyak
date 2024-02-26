import { type FileSystem, AccessPoint } from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";
import type { Workspace } from "./workspace";
import { type IGrantable, PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { Connections, IConnectable } from "aws-cdk-lib/aws-ec2";
import type { PosixGroup } from "./group";

export interface HomeProps {
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
   *
   * @default - same as the uid
   */
  readonly gid?: string;
  /**
   * Secondary groups to assign to files written to this home directory.
   */
  readonly secondaryGroups?: PosixGroup[];
}

/**
 * A Home directory is a secure directory in a {@link Workspace} only
 * accessible by the User who owns it.
 */
export class Home extends Construct implements IConnectable {
  /**
   * The connections for the EFS file system.
   */
  public readonly connections: Connections;
  /**
   * An {@link AccessPoint} to the user's home directory
   */
  public readonly accessPoint: AccessPoint;
  /**
   * The username of the user.
   *
   * Should match the AWS SSO username.
   */
  public readonly username: string;
  /**
   * The POSIX user ID
   */
  public readonly uid: string;
  /**
   * The POSIX group ID
   */
  public readonly gid: string;
  /**
   * Absolute path to the home directory
   */
  public readonly path: string;

  constructor(scope: Construct, id: string, props: HomeProps) {
    super(scope, id);

    this.username = props.username;
    this.uid = props.uid;
    this.gid = props.gid ?? props.uid;
    this.path = `/home/${props.username}`;

    this.connections = props.fileSystem.connections;

    this.accessPoint = new AccessPoint(this, "AccessPoint", {
      fileSystem: props.fileSystem,
      createAcl: {
        ownerGid: this.gid,
        ownerUid: this.uid,
        // locked down for the user
        // user: rwx
        // group: r-x
        // other: ---
        permissions: "750",
      },
      // TODO: this forces all files written through this file system to have this ownership.
      // TODO: is this right? Or should we force consistent username, gid and uid across all EC2 instances?
      posixUser: {
        uid: this.uid,
        gid: this.gid,
        secondaryGids: props.secondaryGroups?.map((g) => `${g.gid}`),
      },
      path: this.path,
    });
  }

  public allowFrom(connectable: IConnectable) {
    this.accessPoint.fileSystem.connections.allowDefaultPortFrom(connectable);
  }

  public grantRead({ grantPrincipal }: IGrantable) {
    grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["elasticfilesystem:DescribeMountTargets"],
        resources: [
          this.accessPoint.fileSystem.fileSystemArn,
          this.accessPoint.accessPointArn,
        ],
      }),
    );
    this.grant(grantPrincipal, ["elasticfilesystem:ClientMount"]);
  }

  public grantReadWrite({ grantPrincipal }: IGrantable) {
    this.grantRead({ grantPrincipal });
    this.grant(grantPrincipal, ["elasticfilesystem:ClientWrite"]);
  }

  public grantRootAccess({ grantPrincipal }: IGrantable) {
    this.grantReadWrite({ grantPrincipal });
    this.grant(grantPrincipal, ["elasticfilesystem:ClientRootAccess"]);
  }

  public grant({ grantPrincipal }: IGrantable, actions: string[]) {
    grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: actions,
        resources: [this.accessPoint.fileSystem.fileSystemArn],
        conditions: {
          // see: https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelasticfilesystem.html#amazonelasticfilesystem-resources-for-iam-policies
          StringEquals: {
            "elasticfilesystem:AccessPointArn": this.accessPoint.accessPointArn,
          },
          Bool: {
            "elasticfilesystem:AccessedViaMountTarget": true,
          },
        },
      }),
    );
  }
}
