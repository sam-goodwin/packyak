import { Version } from "../version";

export class PythonVersion extends Version {
  public static readonly V3_7 = new PythonVersion("3.7");
  public static readonly V3_8 = new PythonVersion("3.8");
  public static readonly V3_9 = new PythonVersion("3.9");
  public static readonly V3_10 = new PythonVersion("3.10");
  public static readonly V3_11 = new PythonVersion("3.11");
  public static readonly V3_12 = new PythonVersion("3.12");
  public static readonly LATEST = PythonVersion.V3_8;
}
