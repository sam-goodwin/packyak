import type { Cluster } from "./cluster";

/**
 * A Table Catalog implementation provides
 */
export interface ICatalog {
  /**
   * Bind this Catalog to a {@link Cluster} by granting any required IAM Policies
   * and adding any required configurations to the Cluster.
   *
   * @param cluster the cluster to bind this catalog to
   * @param catalogName the name to bind the catalog under
   */
  bind(cluster: Cluster, catalogName: string): void;
}
