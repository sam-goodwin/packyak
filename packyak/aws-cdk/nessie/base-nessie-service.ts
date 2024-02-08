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

export interface BaseNessieServiceProps {
  serviceName: string;
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

export interface INessieService {
  /**
   * The URL to this Nessie service.
   */
  readonly serviceUrl: string;
}

export abstract class BaseNessieService
  extends Construct
  implements INessieService
{
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
   * The {@link NessieConfig} for this service.
   *
   * This will translate to environment variables set at runtime.
   *
   * @see https://projectnessie.org/try/configuration/#configuration
   */
  protected readonly config: NessieConfig;

  constructor(scope: Construct, id: string, props?: BaseNessieServiceProps) {
    super(scope, id);

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
}
