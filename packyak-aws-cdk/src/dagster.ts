import { Construct } from "constructs";
import { IConnectable, Port, Vpc } from "aws-cdk-lib/aws-ec2";
import {
  DatabaseClusterEngine,
  Credentials,
  DatabaseCluster,
  AuroraPostgresEngineVersion,
  ClusterInstance,
  IClusterInstance,
} from "aws-cdk-lib/aws-rds";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { RemovalPolicy } from "aws-cdk-lib/core";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";

export interface DagsterServiceProps {
  /**
   * The VPC to deploy the service to.
   *
   * You must specify either {@link vpc} or {@link cluster}.
   */
  readonly vpc?: Vpc;
  /**
   * The ECS cluster to deploy the service to.
   *
   * You must specify either {@link vpc} or {@link cluster}.
   */
  readonly cluster?: Cluster;
  /**
   * The database to deploy to.
   */
  readonly database?: DagsterDatabaseProps;
  /**
   * The removal policy to use for the database and service.
   *
   * @default - The database is not removed automatically.
   */
  readonly removalPolicy?: RemovalPolicy;
}

export interface DagsterDatabaseProps {
  /**
   * Credentials for the administrative user
   *
   * @default - A username of 'admin' and SecretsManager-generated password
   */
  readonly credentials?: Credentials;
  /**
   * An optional identifier for the cluster
   *
   * @default - A name is automatically generated.
   */
  readonly clusterIdentifier?: string;
  /**
   * The writer instance to use for the database.
   *
   * @default - A serverless instance is created.
   */
  readonly writer?: IClusterInstance;
  /**
   * The readers instances to use for the database.
   *
   * @default - No readers are created.
   */
  readonly readers?: IClusterInstance[];
  /**
   * The port to connect to the database on.
   *
   * @default - 5432
   */
  readonly port?: number;
}

/**
 * Represents a Dagster service deployment in AWS, encapsulating the necessary AWS resources.
 *
 * This class allows for the easy setup of a Dagster service with a connected Aurora Postgres database
 * within an ECS cluster. It abstracts away the complexity of directly dealing with AWS CDK constructs
 * for creating and configuring the ECS service, database, and necessary permissions.
 */
export class DagsterService extends Construct {
  public readonly database: DatabaseCluster;
  public readonly databaseSecret: ISecret;

  constructor(scope: Construct, id: string, props: DagsterServiceProps) {
    super(scope, id);

    if (props.cluster === undefined && props.vpc === undefined) {
      throw new Error("One of cluster or vpc must be provided.");
    }
    if (props.cluster && props.vpc) {
      throw new Error("Only one of cluster or vpc can be provided, not both.");
    }
    const cluster =
      props.cluster ??
      new Cluster(this, "DagsterCluster", {
        vpc: props.vpc,
      });
    const vpc = props.vpc ?? cluster.vpc;

    // TODO: deploy the service once we are ready to move away from hand running things on EMR
    // this.service = new ApplicationLoadBalancedFargateService(this, "Service", {
    //   cluster,
    //   taskImageOptions: {
    //     image: ContainerImage.fromRegistry(props.dagsterImage),
    //   },
    //   publicLoadBalancer: true,
    // });

    this.database = new DatabaseCluster(this, "Database", {
      vpc,
      engine: DatabaseClusterEngine.auroraPostgres({
        // version is 14.6 according to HELM charts
        // @see https://github.com/dagster-io/dagster/blob/4bb81fdb84a7775d3fd03190a2edf1a173def4b6/helm/dagster/values.yaml#L765
        version: AuroraPostgresEngineVersion.VER_14_6,
      }),
      writer: props.database?.writer ?? ClusterInstance.serverlessV2("writer"),
      readers: props.database?.readers,
      credentials: props.database?.credentials,
      removalPolicy: props.removalPolicy,
      clusterIdentifier: props.database?.clusterIdentifier,
      port: props.database?.port,
    });
    this.databaseSecret = this.database.secret!;
  }

  /**
   * Allow a connectable to access the database.
   *
   * @param connectable The connectable to allow access from.
   */
  public allowDBAccessFrom(connectable: IConnectable) {
    this.database.connections.allowFrom(
      connectable,
      Port.tcp(this.database.clusterEndpoint.port),
    );
  }
}
