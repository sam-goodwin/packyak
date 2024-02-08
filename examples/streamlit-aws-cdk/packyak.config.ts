import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";
import { StreamlitSite, LakeHouse } from "packyak/aws-cdk";

const app = new App();

const stack = new Stack(app, "streamlit-example-aws-cdk");

const stage = process.env.STAGE ?? "personal";

const lakeHouse = new LakeHouse(stack, "DataLake", {
  lakehouseName: `streamlit-example-aws-cdk-${stage}`,
  module: "app",
  removalPolicy: RemovalPolicy.DESTROY,
});

// const site = new StreamlitSite(stack, "StreamlitSite", {
//   lakeHouse,
//   home: "app/home.py",
// });

// stack.addOutputs({
//   SiteUrl: site.url,
// });
