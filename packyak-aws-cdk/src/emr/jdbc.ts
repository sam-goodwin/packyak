import { IConnectable, Port } from "aws-cdk-lib/aws-ec2";
import type { Cluster } from "./cluster";
import { mergeSparkExtraJars } from "./spark-config";

/**
 * https://mr3docs.datamonad.com/docs/k8s/advanced/transport/
 */
export enum TransportMode {
  BINARY = "binary",
  HTTP = "http",
  ALL = "all",
}

export interface JdbcProps {
  /**
   * @see https://spark.apache.org/docs/latest/sql-distributed-sql-engine.html
   */
  readonly port: number;
  /**
   * @default
   */
  readonly hiveConf?: Record<string, string>;
  readonly sparkConf?: Record<string, string>;
  readonly extraJavaOptions?: Record<string, string>;
}

/**
 * Configures an EMR Cluster to start a Thrift Server daemon.
 */
export class Jdbc {
  constructor(
    private readonly cluster: Cluster,
    private readonly options: JdbcProps,
  ) {
    const hiveConf = options.hiveConf ?? {};

    hiveConf["hive.server2.thrift.port"] = options.port.toString(10);

    const sparkConf = options.sparkConf ?? {};
    const extraJavaOptions = mergeSparkExtraJars(
      cluster.extraJavaOptions,
      sparkConf["spark.driver.extraJavaOptions"],
      options.extraJavaOptions,
    );
    if (extraJavaOptions) {
      sparkConf["spark.driver.extraJavaOptions"] = `'${extraJavaOptions}'`;
    }
    this.cluster.addStep({
      name: "StartThriftServer",
      hadoopJarStep: {
        jar: "command-runner.jar",
        args: [
          "sudo",
          "-u",
          "spark",
          "bash",
          "-c",
          // sudo -u spark bash -c "/lib/spark/sbin/start-thriftserver.sh --hiveconf hive.server2.thrift.port=10001 --hiveconf hive.execution.engine=spark --conf spark.sql.hive.thriftServer.singleSession=true --conf spark.driver.extraJavaOptions='-Djdk.httpclient.allowRestrictedHeaders=host'"
          `/lib/spark/sbin/start-thriftserver.sh --hiveconf hive.server2.thrift.port=10001 --hiveconf hive.execution.engine=spark --conf spark.driver.extraJavaOptions='-Djdk.httpclient.allowRestrictedHeaders=host' ${[
            ...Object.entries(sparkConf).flatMap(([k, v]) => [
              "--hiveconf",
              `${k}=${v}`,
            ]),
            ...Object.entries(sparkConf).flatMap(([k, v]) => [
              "--conf",
              `${k}=${v}`,
            ]),
          ].join(" ")}`,
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
