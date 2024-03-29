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
   * @see https://project-nessie.zulipchat.com/#narrow/stream/371187-general/topic/AWS.20Lambda.20with.20SnapStart/near/420329834
   */
  readonly versionStoreName?: string;
  /**
   * @default - RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * @see https://projectnessie.org/try/configuration/#dynamodb-version-store-settings
 */
export class DynamoDBNessieVersionStore extends Construct {
  public readonly refs: Table;
  public readonly objs: Table;
  public readonly tablePrefix: string;
  constructor(scope: Construct, id: string, props?: NessieVersionStoreProps) {
    super(scope, id);
    this.tablePrefix = props?.versionStoreName ?? "nessie";

    this.objs = new NessieVersionStoreTable(this, "objs", {
      tableName: `${this.tablePrefix}_objs`,
      removalPolicy: props?.removalPolicy,
    });
    this.refs = new NessieVersionStoreTable(this, "refs", {
      tableName: `${this.tablePrefix}_refs`,
      removalPolicy: props?.removalPolicy,
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
