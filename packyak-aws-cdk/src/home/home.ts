import {
  FileSystem,
  FileSystemProps,
  ThroughputMode,
} from "aws-cdk-lib/aws-efs";
import { RemovalPolicy } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { Users } from "./users";
import { UserProps } from "./user";

export interface HomeProps extends FileSystemProps {}

/**
 * Represents a "Home" environment in AWS.
 *
 * A Home contains a shared EFS {@link FileSystem} with {@link AccessPoint}s
 * for each {@link User} granted access to the system.
 *
 * A Home can be mounted to EC2 machines, SageMaker Domains and AWS EMR Clusters.
 *
 * A Home is designed to provide a shared environment for a team of developers
 * to work on a project together.
 */
export class Home extends Construct {
  public readonly fileSystem: FileSystem;

  public readonly users: Users;

  constructor(scope: Construct, id: string, props: HomeProps) {
    super(scope, id);

    this.fileSystem = new FileSystem(this, "HomeFileSystem", {
      ...props,
      vpc: props.vpc,
      // switch default to Elastic as it seems more hands off
      throughputMode: props.throughputMode ?? ThroughputMode.ELASTIC,
      // switch the default to encrypted, this is designed to store sensitive user data in a home directory
      // e.g. ssh keys, .env files, API keys, credentials, proprietary code
      encrypted: props.encrypted ?? true,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    this.users = new Users(this, "Users", {
      fileSystem: this.fileSystem,
    });
  }

  public addUser(props: UserProps) {
    return this.users.add(props);
  }
}
