export function nessieConfigToEnvironment(config: NessieConfig): {
  [key: string]: string;
} {
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => [
      k.toUpperCase().replace(/[\._-]/g, "_"),
      v.toString(),
    ]),
  );
}

/**
 * TODO: support others if necessary. For now DynamoDB is ideal for AWS.
 *
 * @see https://projectnessie.org/try/configuration/#support-for-the-database-specific-implementations
 */
export enum NessieVersionStoreType {
  DYNAMODB = "DYNAMODB",
}

/**
 * Nessie configuration settings.
 *
 * @see https://projectnessie.org/try/configuration/#configuration
 */
export interface NessieConfig {
  /**
   * @default main
   */
  readonly "nessie.server.default-branch"?: string;
  /**
   * @see https://projectnessie.org/try/configuration/#support-for-the-database-specific-implementations
   */
  readonly "nessie.version.store.type": NessieVersionStoreType;
  /**
   * @default - region CDK stack is deployed to
   * @see https://docs.quarkiverse.io/quarkus-amazon-services/dev/amazon-dynamodb.html#quarkus-amazon-dynamodb_quarkus.dynamodb.aws.region
   */
  readonly "quarkus.dynamodb.aws.region"?: string;
  /**
   * @default aws-crt
   * @see https://docs.quarkiverse.io/quarkus-amazon-services/dev/amazon-dynamodb.html#quarkus-amazon-dynamodb_quarkus.dynamodb.sync-client.type
   */
  readonly "quarkus.dynamodb.sync-client.type"?: "aws-crt" | "apache" | "url";
  /**
   * @default aws-crt
   * @see https://docs.quarkiverse.io/quarkus-amazon-services/dev/amazon-dynamodb.html#quarkus-amazon-dynamodb_quarkus.dynamodb.async-client.type
   */
  readonly "quarkus.dynamodb.async-client.type"?: "aws-crt" | "netty";
  /**
   * @see https://docs.quarkiverse.io/quarkus-amazon-services/dev/amazon-dynamodb.html#quarkus-amazon-dynamodb_quarkus.dynamodb.devservices.enabled
   */
  readonly "quarkus.dynamodb.devservices.enabled"?: boolean;
  /**
   * Determines the name of the `objs` and `refs` tables:
   * Objects table:     `{prefix}_objs`
   * References table:  `{prefix}_refs`
   *
   * @see https://projectnessie.org/try/configuration/#dynamodb-version-store-settings
   */
  readonly "nessie.version.store.persist.dynamodb.table-prefix"?: string;

  // auth: https://github.com/projectnessie/nessie/blob/ae208dd02d18e003da6c4223e42da1b0099ebb19/servers/quarkus-server/src/main/resources/application.properties#L171-L177

  readonly "quarkus.oidc.tenant-enabled"?: boolean;

  readonly "quarkus.smallrye-health.root-path"?: string;

  /**
   * @see https://quarkus.io/guides/aws-lambda-snapstart
   */
  readonly "quarkus.snapstart.enable"?: boolean;
}
