import { IConnectable, Port } from "aws-cdk-lib/aws-ec2";
import type { Cluster } from "./cluster.js";
import { toCLIArgs, mergeSparkExtraJars } from "./spark-config.js";

/**
 * https://mr3docs.datamonad.com/docs/k8s/advanced/transport/
 */
export enum TransportMode {
  Binary = "binary",
  HTTP = "http",
  All = "all",
}

export interface HiveConfig {
  "hive.aux.jars.path"?: string;
  "hive.server2.transport.mode"?: TransportMode;
}

export interface SparkConf {
  "spark.driver.extraJavaOptions"?: string;
}

export interface JDBCProps {
  /**
   * @see https://spark.apache.org/docs/latest/sql-distributed-sql-engine.html
   */
  port: number;
  /**
   * Include tje .ivy2/jars directory so that the server will pick up extra extensions
   *
   * @default true
   */
  includeExtensions?: boolean;
  /**
   * @default
   */
  hiveConf?: Record<string, string>;
  sparkConf?: Record<string, string>;
  extraJavaOptions?: Record<string, string>;
}

/**
 * Configures an EMR Cluster to start a Thrift Server daemon.
 */
export class JDBC {
  constructor(
    private readonly cluster: Cluster,
    private readonly options: JDBCProps,
  ) {
    const hiveConf = options.hiveConf ?? {};
    if (
      // If the user has not explicitly disabled the inclusion of the .ivy2/jars directory
      options.includeExtensions !== false &&
      hiveConf["hive.aux.jars.path"] === undefined
    ) {
      // TODO: ideally not the /root/ user...
      hiveConf["hive.aux.jars.path"] = "/root/.ivy2/jars/";
    }

    const sparkConf = options.sparkConf ?? {};
    if (options.extraJavaOptions) {
      sparkConf["spark.driver.extraJavaOptions"] = mergeSparkExtraJars(
        options.extraJavaOptions,
        sparkConf["spark.driver.extraJavaOptions"],
      );
    }
    this.cluster.addStep({
      name: "StartThriftServer",
      hadoopJarStep: {
        jar: "command-runner.jar",
        args: [
          "bash",
          "-c",
          [
            // FIXME: this probably shouldn't be root but we need to set up a proper user
            //        to make that the case since the default hadoop user doesn't have permission
            //        to write to the log directory.
            "sudo",
            "/lib/spark/sbin/start-thriftserver.sh",
            Object.keys(hiveConf).length > 0
              ? ["--hiveconf", toCLIArgs(hiveConf)]
              : [],
            Object.keys(hiveConf).length > 0
              ? ["--conf", toCLIArgs(sparkConf)]
              : [],
          ].join(" "),
        ],
      },
      actionOnFailure: "CANCEL_AND_WAIT",
    });
  }

  public allowFrom(...connectables: IConnectable[]) {
    for (const connectable of connectables) {
      this.cluster.connections.allowFrom(
        connectable,
        Port.tcp(this.options.port),
      );
    }
  }
}
