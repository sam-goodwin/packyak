import { StreamlitSite, Packyak } from "packyak/aws-cdk";
import { App, Stack } from "aws-cdk-lib/core";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";

const app = new App();
const stack = new Stack(app, "example-streamlit");

const packyak = new Packyak(stack, "Packyak", {
  entry: "-m app",
});

new StreamlitSite(stack, "StreamlitSite", {
  packyak,
  image: ContainerImage.fromRegistry("python:3.12-slim"),
  home: "app/home.py",
});
