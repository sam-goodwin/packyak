import { App, Stack } from "aws-cdk-lib/core";
import { StreamlitSite, DataLake } from "packyak/aws-cdk";

const app = new App();

const stack = new Stack(app, "streamlit-example-aws-cdk");

const dataLake = new DataLake(stack, "DataLake", {
  name: "streamlit-example-aws-cdk",
  stage: process.env.STAGE ?? "personal",
  module: "app",
});

const site = new StreamlitSite(stack, "StreamlitSite", {
  dataLake,
  home: "app/home.py",
});

stack.addOutputs({
  SiteUrl: site.url,
});
