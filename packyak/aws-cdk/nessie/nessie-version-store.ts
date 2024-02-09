import { Table, AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { RemovalPolicy } from "aws-cdk-lib/core";
import { Construct } from "constructs";

export interface NessieVersionStoreProps {
  /**
   * Nessie has two tables, `objs` and `refs`.
   *
   * Nessie supports configuring a "prefix" that will be used to determine the names of these tables.
   *
   * @default - "nessie"
   */
  tablePrefix?: string;
}

/**
 * @see https://projectnessie.org/try/configuration/#dynamodb-version-store-settings
 */
export class NessieVersionStore extends Construct {
  public readonly refs: Table;
  public readonly objs: Table;
  public readonly tablePrefix: string;
  constructor(scope: Construct, id: string, props?: NessieVersionStoreProps) {
    super(scope, id);
    this.tablePrefix = props?.tablePrefix ?? "nessie";
    this.objs = new NessieVersionStoreTable(this, "objs", {
      tableName: `${this.tablePrefix}_objs`,
    });
    this.refs = new NessieVersionStoreTable(this, "refs", {
      tableName: `${this.tablePrefix}_refs`,
    });
  }

  public grantReadData(grantee: IGrantable) {
    this.objs.grantReadData(grantee);
    this.refs.grantReadData(grantee);
  }

  public grantWriteData(grantee: IGrantable) {
    this.objs.grantWriteData(grantee);
    this.refs.grantWriteData(grantee);
  }

  public grantReadWriteData(grantee: IGrantable) {
    this.objs.grantReadWriteData(grantee);
    this.refs.grantReadWriteData(grantee);
  }
}

interface NessieVersionStoreTableProps {
  tableName: string;
  /**
   * @default - RemovalPolicy.DESTROY
   */
  removalPolicy?: RemovalPolicy;
}

class NessieVersionStoreTable extends Table {
  constructor(
    scope: Construct,
    id: string,
    props: NessieVersionStoreTableProps,
  ) {
    super(scope, id, {
      tableName: props.tableName,
      partitionKey: {
        name: "k",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
    this.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.DESTROY);
  }
}
