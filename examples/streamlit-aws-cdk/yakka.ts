import { StreamlitSite, Yakka } from "yakka/aws-cdk";
import { App, Stack } from "aws-cdk-lib/core";
import { ContainerImage } from "aws-cdk-lib/aws-ecs";

const app = new App();
const stack = new Stack(app, "example-streamlit");

const yakka = new Yakka(stack, "Yakka", {
  entry: "-m app",
});

new StreamlitSite(stack, "StreamlitSite", {
  yakka,
  image: ContainerImage.fromRegistry("python:3.12-slim"),
  home: "app/home.py",
});
