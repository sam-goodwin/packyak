import { Construct } from "constructs";
import {
  ClusterInstance,
  DatabaseCluster,
  DatabaseClusterEngine,
} from "aws-cdk-lib/aws-rds";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import {
  FargateService,
  Cluster,
  FargateTaskDefinition,
  ContainerImage,
} from "aws-cdk-lib/aws-ecs";

export interface DagsterClusterProps {
  vpc: IVpc;
}

/**
 * TODO: this is not complete or tested
 */
export class DagsterCluster extends Construct {
  public readonly cluster: Cluster;
  public readonly database: DatabaseCluster;
  public readonly task: FargateTaskDefinition;
  public readonly service: FargateService;

  constructor(scope: Construct, id: string, props: DagsterClusterProps) {
    super(scope, id);

    this.database = new DatabaseCluster(this, "Database", {
      engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
      vpc: props.vpc,
      writer: ClusterInstance.provisioned("writer", {
        publiclyAccessible: false,
      }),
    });

    this.cluster = new Cluster(this, "DagsterCluster", {
      vpc: props.vpc,
    });

    this.task = new FargateTaskDefinition(this, "DagsterTask", {});

    const webserver = this.task.addContainer("Webserver", {
      image: ContainerImage.fromAsset(__dirname, {
        buildArgs: {
          "--target": "webserver",
        },
      }),
      environment: {
        DAGSTER_POSTGRES_HOSTNAME: `postgresql://${this.database.clusterEndpoint.hostname}/`,
      },
    });
    //
    const dagster = this.task.addContainer("Dagster", {
      image: ContainerImage.fromAsset(__dirname, {
        buildArgs: {
          "--target": "webserver",
        },
      }),
      environment: {},
    });

    // user code can run in many places, like:
    // AWS Batch
    // AWS Lambda
    // AWS Spark

    this.service = new FargateService(this, "DagsterService", {
      cluster: this.cluster,
      taskDefinition: this.task,
    });
  }
}
