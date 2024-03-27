import { Construct } from "constructs";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import {
  DatabaseClusterEngine,
  AuroraPostgresEngineVersion,
  ServerlessCluster,
  ServerlessScalingOptions,
  Credentials,
} from "aws-cdk-lib/aws-rds";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { RemovalPolicy } from "aws-cdk-lib/core";

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
   * Scaling configuration of an Aurora Serverless database cluster.
   *
   * @default - Serverless cluster is automatically paused after 5 minutes of being idle.
   *   minimum capacity: 2 ACU
   *   maximum capacity: 16 ACU
   */
  readonly scaling?: ServerlessScalingOptions;
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
}

export class DagsterService extends Construct {
  public readonly database: ServerlessCluster;

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

    this.database = new ServerlessCluster(this, "AuroraCluster", {
      vpc,
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_16_0,
      }),
      scaling: props.database?.scaling,
      credentials: props.database?.credentials,
      removalPolicy: props.removalPolicy,
      clusterIdentifier: props.database?.clusterIdentifier,
    });
  }
}
