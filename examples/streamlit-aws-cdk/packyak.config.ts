import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { LakeHouse, Domain, AuthMode, SparkCluster } from "@packyak/aws-cdk";

const app = new App();

const stack = new Stack(app, "streamlit-example-aws-cdk-2");

const stage = process.env.STAGE ?? "personal";

const lakeHouse = new LakeHouse(stack, "DataLake", {
  lakehouseName: `streamlit-example-aws-cdk-${stage}`,
  module: "app",
  removalPolicy: RemovalPolicy.DESTROY,
});

const domain = new Domain(stack, "Domain", {
  domainName: `streamlit-example-aws-cdk-${stage}`,
  vpc: lakeHouse.vpc,
  authMode: AuthMode.IAM,
  removalPolicy: RemovalPolicy.DESTROY,
});

const spark = new SparkCluster(stack, "SparkCluster", {
  clusterName: "streamlit-example",
  catalogs: {
    spark_catalog: lakeHouse.catalog,
  },
  vpc: lakeHouse.vpc,
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
