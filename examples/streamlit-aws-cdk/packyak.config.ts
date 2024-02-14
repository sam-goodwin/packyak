import {
  AuthMode,
  Domain,
  DynamoDBNessieVersionStore,
  NessieECSCatalog,
  SparkCluster,
} from "@packyak/aws-cdk";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";

const stage = process.env.STAGE ?? "personal";

const lakeHouseName = `packyak-example-${stage}`;

const app = new App();

const stack = new Stack(app, lakeHouseName);
const vpc = new Vpc(stack, "Vpc");

const versionStore = new DynamoDBNessieVersionStore(stack, "VersionStore", {
  versionStoreName: `${lakeHouseName}-version-store`,
});

const myRepoBucket = new Bucket(stack, "MyCatalogBucket", {
  removalPolicy: RemovalPolicy.DESTROY,
});

const myCatalog = new NessieECSCatalog(stack, "MyCatalog", {
  vpc,
  warehouseBucket: myRepoBucket,
  catalogName: lakeHouseName,
  removalPolicy: RemovalPolicy.DESTROY,
  versionStore,
});

const domain = new Domain(stack, "Domain", {
  removalPolicy: RemovalPolicy.DESTROY,
  domainName: `streamlit-example-aws-cdk-${stage}`,
  vpc,
  authMode: AuthMode.IAM,
});

const spark = new SparkCluster(stack, "SparkCluster", {
  clusterName: "streamlit-example",
  catalogs: {
    spark_catalog: myCatalog,
  },
  vpc,
  sageMakerSg: domain.sageMakerSg,
});

domain.addUserProfile("sam");

// const site = new StreamlitSite(stack, "StreamlitSite", {
//   lakeHouse,
//   home: "app/home.py",
// });

// stack.addOutputs({
//   NessieUrl: lakeHouse.nessie.serviceUrl,
//   // SiteUrl: site.url,
// });
