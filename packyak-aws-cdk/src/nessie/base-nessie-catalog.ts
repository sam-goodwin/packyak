import { Construct } from "constructs";
import {
  NessieVersionStoreProps,
  NessieVersionStore,
} from "./nessie-version-store";
import {
  NessieConfig,
  NessieVersionStoreType,
  nessieConfigToEnvironment,
} from "./nessie-config";
import { RemovalPolicy } from "aws-cdk-lib/core";
import { ICatalog } from "../emr/catalog";
import { SparkCluster } from "../emr/spark-cluster";
import { Configuration } from "../emr/configuration";
import { SparkSqlExtension } from "../emr/spark-sql-extension";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";

export interface INessieCatalog extends ICatalog {
  /**
   * The URL to this Nessie service.
   */
  readonly serviceUrl: string;
  /**
   * Endpoint for the Nessie API v1.
   *
   * This endpoint provides access to the version 1 of the Nessie API. It is recommended to use the v2 endpoint for the latest features and improvements.
   *
   * @deprecated This version of the API is deprecated and will be removed in future releases. Use {@link apiV2Url} instead.
   */
  readonly apiV1Url: string;
  /**
   * Endpoint for the Nessie API v2.
   *
   * This endpoint provides access to the version 2 of the Nessie API. It is the recommended endpoint to use for all interactions with the Nessie service.
   *
   * Note: The Nessie CLI is compatible only with this version of the API. For CLI interactions, ensure to use this endpoint.
   */
  readonly apiV2Url: string;
  /**
   * The default main branch of the Nessie repository.
   *
   * This property specifies the main branch that will be used by default for all operations within the Nessie service.
   *
   * @default main
   */
  readonly defaultMainBranch: string;
}

export interface BaseNessieCatalogProps {
  /**
   * @default - one is created for you
   */
  warehouseBucket?: IBucket;
  /**
   * The prefix to use for the warehouse path.
   *
   * @default - no prefix (e.g. use the root: `s3://bucket/`)
   */
  warehousePrefix?: string;
  /**
   * The name of the log group that will be created for the Nessie server.
   */
  logGroupName?: string;
  /**
   * The default main branch of a Nessie repository.
   *
   * @default main
   */
  defaultMainBranch?: string;
  /**
   * Properties for configuring the {@link NessieVersionStore}
   */
  versionStore?: NessieVersionStoreProps;
  /**
   * The removal policy to apply to the Nessie service.
   *
   * @default RemovalPolicy.DESTROY - dynamodb tables will be destroyed.
   */
  removalPolicy?: RemovalPolicy;
}

export abstract class BaseNessieCatalog
  extends Construct
  implements INessieCatalog
{
  /**
   * The {@link NessieConfig} for this service.
   *
   * This will translate to environment variables set at runtime.
   *
   * @see https://projectnessie.org/try/configuration/#configuration
   */
  protected readonly config: NessieConfig;
  /**
   * The DynamoDB Table storing all
   *
   * @see https://projectnessie.org/develop/kernel/#high-level-abstract
   */
  public readonly versionStore: NessieVersionStore;
  /**
   * The default main branch of a Nessie repository created in this service.
   */
  public readonly defaultMainBranch: string;
  /**
   * The URL to this Nessie service.
   */
  public abstract readonly serviceUrl: string;
  /**
   * The S3 bucket used as the warehouse for Nessie.
   */
  public readonly warehouseBucket: IBucket;
  /**
   * The prefix to use for the warehouse path.
   */
  public readonly warehousePrefix: string | undefined;
  /**
   * Endpoint for the Nessie API v1.
   *
   * @deprecated use {@link apiV2Url} instead
   */
  public get apiV1Url() {
    return `${this.serviceUrl}/api/v1`;
  }
  /**
   * Endpoint for the Nessie API v2.
   *
   * Note: Nessie CLI is not compatible with V1. For CLI use {@link apiV2Url}
   */
  public get apiV2Url() {
    return `${this.serviceUrl}/api/v2`;
  }

  constructor(scope: Construct, id: string, props?: BaseNessieCatalogProps) {
    super(scope, id);

    this.warehouseBucket =
      props?.warehouseBucket ?? new Bucket(this, "Warehouse");
    this.warehousePrefix = props?.warehousePrefix;

    this.defaultMainBranch = props?.defaultMainBranch ?? "main";

    // @see https://github.com/projectnessie/nessie/blob/09762d2b80ca448782c2f4326e3e41f1447ae6e0/versioned/storage/dynamodb/src/main/java/org/projectnessie/versioned/storage/dynamodb/DynamoDBConstants.java#L37
    this.versionStore = new NessieVersionStore(
      this,
      "VersionStore",
      props?.versionStore,
    );

    this.config = {
      "nessie.version.store.type": NessieVersionStoreType.DYNAMODB,
      "nessie.version.store.persist.dynamodb.table-prefix":
        this.versionStore.tablePrefix,
      "nessie.server.default-branch": this.defaultMainBranch,
      "quarkus.dynamodb.async-client.type": "aws-crt",
      "quarkus.dynamodb.sync-client.type": "aws-crt",
      "quarkus.oidc.tenant-enabled": false,
    };
  }

  protected getConfigEnvVars() {
    return nessieConfigToEnvironment(this.config);
  }

  public bind(cluster: SparkCluster): Configuration[] {
    // TODO: should we limit this to the warehouse prefix
    this.warehouseBucket.grantReadWrite(cluster, "*");
    const sparkVersion = cluster.release.sparkVersion;
    const scalaVersion = cluster.release.scalaVersion;

    const nessieExt = SparkSqlExtension.Nessie.maven(
      sparkVersion,
      scalaVersion,
    );
    const icebergExt = SparkSqlExtension.Iceberg.maven(
      sparkVersion,
      scalaVersion,
    );

    return [
      {
        classification: "spark-defaults",
        configurationProperties: {
          // set up Nessie catalog
          "spark.jar.packages": `${icebergExt},${nessieExt}`,
          "spark.sql.extensions": `${SparkSqlExtension.Iceberg.className},${SparkSqlExtension.Nessie.className}`,

          // TODO: is s3a:// right?
          "spark.sql.catalog.nessie.warehouse": `s3a://${
            this.warehouseBucket.bucketName
          }${
            this.warehousePrefix
              ? `/${this.warehousePrefix.replace(/^[\/]*/g, "")}`
              : ""
          }`,
          "spark.sql.catalog.nessie.uri": this.apiV2Url,
          "spark.sql.catalog.nessie.ref": this.defaultMainBranch,
          "spark.sql.catalog.nessie.authentication.type": "AWS",
          "spark.sql.catalog.nessie.catalog-impl":
            "org.apache.iceberg.nessie.NessieCatalog",
          "spark.sql.catalog.nessie": "org.apache.iceberg.spark.SparkCatalog",
          "spark.sql.catalog.nessie.io-impl":
            "org.apache.iceberg.aws.s3.S3FileIO",
          // "spark.sql.catalog.nessie.cache-enabled": false
        },
      },
    ];
  }
}
