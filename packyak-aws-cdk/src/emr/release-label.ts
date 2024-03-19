import { PythonVersion } from "./python-version";
import { ScalaVersion } from "./scala-version";
import { SparkVersion } from "./spark-version";

export class ReleaseLabel {
  public static readonly EMR_7_0_0 = new ReleaseLabel(
    "emr-7.0.0",
    new SparkVersion("3.5.0"),
    new PythonVersion("3.9"),
    new ScalaVersion("2.12.17"),
  );
  public static readonly EMR_6_15_0 = new ReleaseLabel(
    "emr-6.15.0",
    new SparkVersion("3.4.1"),
    new PythonVersion("3.7"),
    new ScalaVersion("2.12.17"),
  );
  public static readonly EMR_6 = this.EMR_6_15_0;
  public static readonly LATEST = this.EMR_7_0_0;

  constructor(
    readonly label: string,
    readonly sparkVersion: SparkVersion,
    readonly pythonVersion: PythonVersion,
    readonly scalaVersion: ScalaVersion,
  ) {}

  public get majorVersion(): number {
    return Number(this.label.split("-")[1].split(".")[0]);
  }
}
