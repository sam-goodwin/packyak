import {
  AuthMode,
  Domain,
  DynamoDBNessieVersionStore,
  NessieECSCatalog,
  Cluster,
  Workspace,
} from "@packyak/aws-cdk";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";

const stage = process.env.STAGE ?? "personal";
const removalPolicy = RemovalPolicy.DESTROY;

const lakeHouseName = `packyak-example-${stage}`;

const app = new App();

const stack = new Stack(app, lakeHouseName);
const vpc = new Vpc(stack, "Vpc");

const versionStore = new DynamoDBNessieVersionStore(stack, "VersionStore", {
  versionStoreName: `${lakeHouseName}-version-store`,
});

const myRepoBucket = new Bucket(stack, "MyCatalogBucket", {
  removalPolicy,
});

const myCatalog = new NessieECSCatalog(stack, "MyCatalog", {
  vpc,
  warehouseBucket: myRepoBucket,
  catalogName: lakeHouseName,
  removalPolicy,
  versionStore,
});

// create a workspace
const workspace = new Workspace(stack, "Workspace", {
  vpc,
  removalPolicy,
});
const sam = workspace.addHome({
  username: "sam",
  uid: "2001",
});

const spark = new Cluster(stack, "SparkCluster", {
  clusterName: "example",
  vpc,
  catalogs: {
    spark_catalog: myCatalog,
  },
  extraJavaOptions: {
    "-Djdk.httpclient.allowRestrictedHeaders": "host",
  },
  installSSMAgent: true,
});

// spark.mount(workspace.ssm);
spark.mount(sam);

const sparkSQL = spark.jdbc({
  port: 10000,
});

const domain = new Domain(stack, "Domain", {
  domainName: `streamlit-example-aws-cdk-${stage}`,
  vpc,
  authMode: AuthMode.IAM,
  removalPolicy,
});

domain.addUserProfile("sam");

// allow the SageMaker domain to connect to the Spark's JDBC Hive service
sparkSQL.allowFrom(domain);

// allow the SageMaker domain to connect to the Spark's Ivy service
spark.allowLivyFrom(domain);

// allow the SageMaker domain to start a session on the Spark cluster
spark.grantStartSSMSession(domain);

// spark.connections.allowFrom(domain.sageMakerSg, Port.tcp(443));

// spark.allowHttpsFrom(domain.sageMakerSg);

// const site = new StreamlitSite(stack, "StreamlitSite", {
//   lakeHouse,
//   home: "app/home.py",
// });

// stack.addOutputs({
//   NessieUrl: lakeHouse.nessie.serviceUrl,
//   // SiteUrl: site.url,
// });
