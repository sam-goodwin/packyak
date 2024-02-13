import type { Configuration } from "./configuration.js";
import type { SparkCluster } from "./spark-cluster.js";

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
  bind(cluster: SparkCluster): Configuration[];
}
