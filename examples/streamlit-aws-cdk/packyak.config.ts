import { StreamlitSite, DataLake } from "packyak/aws-cdk";
import { App, Stack } from "aws-cdk-lib/core";

export default function () {
  const app = new App({
    autoSynth: false,
  });
  const stack = new Stack(app, "example-streamlit");

  const dataLake = new DataLake(stack, "Packyak", {
    entry: "-m app",
  });

  const site = new StreamlitSite(stack, "StreamlitSite", {
    dataLake,
    home: "app/home.py",
  });

  return {
    endpoint: site.endpoint,
  };
}
