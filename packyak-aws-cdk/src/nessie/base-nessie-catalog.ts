import { Construct } from "constructs";
import { DynamoDBNessieVersionStore } from "./nessie-version-store";
import {
  NessieConfig,
  NessieVersionStoreType,
  nessieConfigToEnvironment,
} from "./nessie-config";
import { RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { ICatalog } from "../emr/catalog";
import { Cluster } from "../emr/cluster";
import { SparkSqlExtension } from "../emr/spark-sql-extension";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { ILogGroup } from "aws-cdk-lib/aws-logs";

export interface INessieCatalog extends ICatalog {
  /**
   * The Nessie service endpoint.
   */
  readonly endpoint: string;
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

export interface BaseNessieRepoProps {
  /**
   * The name of this catalog in the Spark Context.
   *
   * @default spark_catalog - i.e. the default catalog
   */
  readonly catalogName?: string;
  /**
   * @default - one is created for you
   */
  readonly warehouseBucket?: IBucket;
  /**
   * The prefix to use for the warehouse path.
   *
   * @default - no prefix (e.g. use the root: `s3://bucket/`)
   */
  readonly warehousePrefix?: string;
  /**
   * The default main branch of a Nessie repository.
   *
   * @default main
   */
  readonly defaultMainBranch?: string;
  /**
   * Properties for configuring the {@link DynamoDBNessieVersionStore}
   */
  readonly versionStore?: DynamoDBNessieVersionStore;
  /**
   * The log group to use for the Nessie service.
   *
   * @default - a new log group is created for you
   */
  readonly logGroup?: ILogGroup;
  /**
   * The removal policy to apply to the Nessie service.
   *
   * @default RemovalPolicy.DESTROY - dynamodb tables will be destroyed.
   */
  readonly removalPolicy?: RemovalPolicy;
}

export abstract class BaseNessieCatalog
  extends Construct
  implements INessieCatalog
{
  /**
   *
   */
  public readonly catalogName: string;
  /**
   * The {@link NessieConfig} for this service.
   *
   * This will translate to environment variables set at runtime.
   *
   * @see https://projectnessie.org/try/configuration/#configuration
   */
  protected readonly config: Record<string, any>;
  /**
   * The DynamoDB Table storing all
   *
   * @see https://projectnessie.org/develop/kernel/#high-level-abstract
   */
  public readonly versionStore: DynamoDBNessieVersionStore;
  /**
   * The default main branch of a Nessie repository created in this service.
   */
  public readonly defaultMainBranch: string;
  /**
   * The URL to this Nessie service.
   */
  public abstract readonly endpoint: string;
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
    return `${this.endpoint}/api/v1`;
  }
  /**
   * Endpoint for the Nessie API v2.
   *
   * Note: Nessie CLI is not compatible with V1. For CLI use {@link apiV2Url}
   */
  public get apiV2Url() {
    return `${this.endpoint}/api/v2`;
  }

  constructor(scope: Construct, id: string, props: BaseNessieRepoProps) {
    super(scope, id);
    this.catalogName = props?.catalogName ?? "spark_catalog";
    this.warehouseBucket =
      props?.warehouseBucket ?? new Bucket(this, "Warehouse");
    this.warehousePrefix = props?.warehousePrefix;

    this.defaultMainBranch = props?.defaultMainBranch ?? "main";

    // @see https://github.com/projectnessie/nessie/blob/09762d2b80ca448782c2f4326e3e41f1447ae6e0/versioned/storage/dynamodb/src/main/java/org/projectnessie/versioned/storage/dynamodb/DynamoDBConstants.java#L37
    this.versionStore =
      props.versionStore ??
      new DynamoDBNessieVersionStore(this, "VersionStore", {
        versionStoreName: `${props.catalogName}-nessie`,
        ...(props?.versionStore ?? {}),
      });

    this.config = {
      "nessie.version.store.type": NessieVersionStoreType.DYNAMODB,
      "nessie.version.store.persist.dynamodb.table-prefix":
        this.versionStore.tablePrefix,
      "nessie.server.default-branch": this.defaultMainBranch,
      "quarkus.dynamodb.async-client.type": "aws-crt",
      "quarkus.dynamodb.sync-client.type": "aws-crt",
      "quarkus.oidc.tenant-enabled": false,
      "quarkus.dynamodb.aws.region": Stack.of(this).region,
    };
  }

  protected configAsEnvVars() {
    // @ts-ignore
    return nessieConfigToEnvironment(this.config);
  }

  public bind(cluster: Cluster, catalogName: string): void {
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

    // see: https://project-nessie.zulipchat.com/#narrow/stream/371187-general/topic/.E2.9C.94.20Merge.20author/near/421208974

    const catalogNamespace = `spark.sql.catalog.${catalogName}`;

    cluster.addConfig({
      classification: "spark-defaults",
      configurationProperties: {
        // set up Nessie catalog
        "spark.jars.packages": `${icebergExt},${nessieExt}`,
        "spark.sql.extensions": `${SparkSqlExtension.Iceberg.className},${SparkSqlExtension.Nessie.className}`,

        // TODO: is s3a:// right?
        [`${catalogNamespace}.warehouse`]: `s3://${
          this.warehouseBucket.bucketName
        }${
          this.warehousePrefix
            ? `/${this.warehousePrefix.replace(/^[\/]*/g, "")}`
            : ""
        }`,
        // TODO: not sure if Spark uses V1 or V2
        // see thread: https://project-nessie.zulipchat.com/#narrow/stream/371187-general/topic/.E2.9C.94.20Merge.20author/near/421198168

        // V1
        // "spark.sql.catalog.nessie.uri": this.apiV1Url,

        // V2
        // // After Iceberg 1.5.0 release, just configuring v2 URI is enough (version is inferred from URI).
        [`${catalogNamespace}.uri`]: this.apiV2Url,
        [`${catalogNamespace}.ref`]: this.defaultMainBranch,
        [`${catalogNamespace}.client-api-version`]: "2",

        [`${catalogNamespace}.authentication.type`]: "AWS",
        [`${catalogNamespace}.catalog-impl`]:
          "org.apache.iceberg.nessie.NessieCatalog",
        [catalogNamespace]: "org.apache.iceberg.spark.SparkCatalog",
        [`${catalogNamespace}.io-impl`]: "org.apache.iceberg.aws.s3.S3FileIO",
        // "spark.sql.catalog.nessie.cache-enabled": false
      },
    });
  }
}
