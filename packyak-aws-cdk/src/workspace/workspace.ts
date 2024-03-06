import type { Connections, IConnectable } from "aws-cdk-lib/aws-ec2";
import {
  FileSystem,
  ThroughputMode,
  type FileSystemProps,
} from "aws-cdk-lib/aws-efs";
import { RemovalPolicy } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { PosixGroup } from "./group";
import { Home } from "./home";

export interface MountFileSystemOptions {
  readonly mountPoint: string;
  readonly username: string;
  readonly uid: number;
  readonly gid: number;
}

export interface AddHomeRequest {
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

export interface WorkspaceProps extends FileSystemProps {}

/**
 * A Workspace is a shared environment for a team of developers to work on a project together.
 *
 * A Workspace contains a shared EFS {@link FileSystem} with {@link AccessPoint}s
 * for each {@link User} granted access to the system.
 *
 * A Workspace can be mounted to EC2 machines, SageMaker Domains and AWS EMR Clusters.
 */
export class Workspace extends Construct implements IConnectable {
  /**
   * EFS File System shared by all users of the Workspace.
   */
  public readonly fileSystem: FileSystem;
  /**
   * Home directory of the `ssm-user` POSIX user.
   *
   * This is the default user assigned when logging into a machine via SSM.
   */
  public readonly ssm: Home;
  /**
   * Connections for the EFS file system
   */
  public readonly connections: Connections;

  // isolated scoping for Home directories
  private readonly homes = new Construct(this, "Homes");

  constructor(scope: Construct, id: string, props: WorkspaceProps) {
    super(scope, id);

    this.fileSystem = new FileSystem(this, "FileSystem", {
      ...props,
      vpc: props.vpc,
      // switch default to Elastic as it seems more hands off
      throughputMode: props.throughputMode ?? ThroughputMode.ELASTIC,
      // switch the default to encrypted, this is designed to store sensitive user data in a home directory
      // e.g. ssh keys, .env files, API keys, credentials, proprietary code
      encrypted: props.encrypted ?? true,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });
    this.connections = this.fileSystem.connections;

    // TODO: disable root permissions from ssm-user
    // https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-ssm-user-permissions.html

    this.ssm = this.addHome({
      username: "ssm-user",
      // TODO: what's the default UID and GID for the ssm-user when created by AWS?
      uid: "2000",
      gid: "2000",
    });
  }

  /**
   * Allow access to the EFS file system from a connectable, e.g. SecurityGroup.
   *
   * @param connectable the connectable to allow access to the shared EFS file system
   */
  public allowFrom(connectable: IConnectable) {
    this.fileSystem.connections.allowDefaultPortFrom(connectable);
  }

  /**
   * Add a home directory to the workspace
   */
  public addHome(props: AddHomeRequest) {
    return new Home(this.homes, props.username, {
      fileSystem: this.fileSystem,
      username: props.username,
      uid: props.uid,
      gid: props.gid,
    });
  }
}
