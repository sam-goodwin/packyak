import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { LakeHouse, Domain, AuthMode } from "packyak/aws-cdk";

const app = new App();

const stack = new Stack(app, "streamlit-example-aws-cdk");

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
});

domain.addUserProfile("sam");

// const site = new StreamlitSite(stack, "StreamlitSite", {
//   lakeHouse,
//   home: "app/home.py",
// });

stack.addOutputs({
  NessieUrl: lakeHouse.nessie.serviceUrl,
  // SiteUrl: site.url,
});
