import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { ICatalog } from "./catalog.js";
import type { Configuration } from "./configuration.js";
import type { SparkCluster } from "./spark-cluster.js";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { SparkSqlExtension } from "./spark-sql-extension.js";

export interface IcebergGlueCatalogProps {
  /**
   * The S3 bucket where the Iceberg table data is stored.
   *
   * @default - one is created for you
   */
  readonly warehouseBucket?: IBucket;
  /**
   * The prefix for the Iceberg table data in the S3 bucket.
   *
   * @default - no prefix (e.g. use the root: `s3://bucket/`)
   */
  readonly warehousePrefix?: string;
}

export class IcebergGlueCatalog extends Construct implements ICatalog {
  private readonly warehouseBucket: IBucket;
  private readonly warehousePrefix: string | undefined;

  public static fromBucketName(
    scope: Construct,
    id: string,
    props: {
      warehouseBucketName: string;
      warehousePrefix?: string;
    },
  ) {
    return new IcebergGlueCatalog(scope, id, {
      warehouseBucket: Bucket.fromBucketName(
        scope,
        `${id}WarehouseBucket`,
        props.warehouseBucketName,
      ),
      warehousePrefix: props.warehousePrefix,
    });
  }

  constructor(scope: Construct, id: string, props: IcebergGlueCatalogProps) {
    super(scope, id);
    this.warehouseBucket =
      props.warehouseBucket ?? new Bucket(this, "WarehouseBucket");
    this.warehousePrefix = props.warehousePrefix;
  }

  public bind(cluster: SparkCluster, catalogName: string): Configuration[] {
    // TODO: should we limit this to the warehouse prefix
    this.warehouseBucket.grantReadWrite(cluster, "*");
    const { partition, region, account } = Stack.of(cluster);
    cluster.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["glue:GetDatabase"],
        resources: [`arn:${partition}:glue:${region}:${account}:catalog`],
      }),
    );
    const sparkVersion = cluster.release.sparkVersion;
    const scalaVersion = cluster.release.scalaVersion;
    const icebergExt = SparkSqlExtension.Iceberg.maven(
      sparkVersion,
      scalaVersion,
    );
    const catalogNamespace = `spark.sql.catalog.${catalogName}`;
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
          "spark.jars.packages": icebergExt,
          "spark.sql.extensions": SparkSqlExtension.Iceberg.className,
          // "spark.sql.catalogImplementation": "hive",
          [catalogNamespace]: "org.apache.iceberg.spark.SparkCatalog",
          [`${catalogNamespace}.warehouse`]: `s3://${
            this.warehouseBucket.bucketName
          }${
            this.warehousePrefix
              ? `/${this.warehousePrefix.replace(/^[\/]*/g, "")}`
              : ""
          }`,
          [`${catalogNamespace}.catalog-impl`]:
            "org.apache.iceberg.aws.glue.GlueCatalog",
          [`${catalogNamespace}.io-impl`]: "org.apache.iceberg.aws.s3.S3FileIO",
        },
      },
    ];
  }

  /*
spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions 
--conf spark.sql.catalog.glue_catalog=org.apache.iceberg.spark.SparkCatalog 
--conf spark.sql.catalog.glue_catalog.warehouse=s3://<your-warehouse-dir>/ 
--conf spark.sql.catalog.glue_catalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog 
--conf spark.sql.catalog.glue_catalog.io-impl=org.apache.iceberg.aws.s3.S3FileIO
*/
}
