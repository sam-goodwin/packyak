import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { Configuration } from "./configuration.js";
import type { SparkCluster } from "./spark-cluster.js";
import { Arn, Stack } from "aws-cdk-lib/core";

/**
 * A Table Catalog implementation provides
 */
export interface ICatalog {
  /**
   * Bind this Catalog to a {@link SparkCluster} by granting any required IAM Policies
   * and returning the {@Link Configuration}s that should be merged in.
   *
   * @param cluster
   */
  bind(cluster: SparkCluster, catalogName: string): Configuration[];
}

export class GlueCatalog implements ICatalog {
  constructor(readonly catalogName: string) {}

  public bind(cluster: SparkCluster, catalogName: string): Configuration[] {
    const { partition, region, account } = Stack.of(cluster);
    cluster.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["glue:GetDatabase"],
        resources: [`arn:${partition}:glue:${region}:${account}:catalog`],
      }),
    );
    return [
      {
        classification: "spark-hive-site",
        configurationProperties: {
          "hive.metastore.client.factory.class":
            "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory",
        },
      },
      {
        classification: "spark-defaults",
        configurationProperties: {
          [`spark.sql.catalog.${catalogName}`]:
            "org.apache.spark.sql.hive.HiveCatalog",
          "spark.sql.catalogImplementation": "hive",
        },
      },
    ];
  }
}
