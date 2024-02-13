import { ScalaVersion } from "./scala-version.js";
import { SparkVersion } from "./spark-version.js";

export class SparkSqlExtension {
  public static readonly Nessie = new SparkSqlExtension(
    "org.projectnessie",
    "nessie-spark-extensions",
    "0.76.6",
    "org.projectnessie.spark.extensions.NessieSparkSessionExtensions",
  );
  public static readonly Iceberg = new SparkSqlExtension(
    "org.apache.iceberg",
    "iceberg-spark-extensions",
    "1.4.3",
    "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions",
  );

  constructor(
    readonly groupId: string,
    readonly artifactId: string,
    readonly pkgVersion: string,
    readonly className: string,
  ) {}

  public maven(sparkVersion: SparkVersion, scalaVersion: ScalaVersion): string {
    return `${this.groupId}:${this.artifactId}-${sparkVersion.majorMinorVersion}_${scalaVersion.majorMinorVersion}@${this.pkgVersion}`;
  }
}
