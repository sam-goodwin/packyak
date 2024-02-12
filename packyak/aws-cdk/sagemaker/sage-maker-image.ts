import { type Stack, CfnMapping, Arn } from "aws-cdk-lib/core";

export const SageMakerImageSingletonID = "sagemaker:image:mapping";

export class SageMakerImage {
  public static readonly CPU_V1 = new SageMakerImage(
    "sagemaker-distribution-cpu-v1",
  );
  public static readonly CPU_V0 = new SageMakerImage(
    "sagemaker-distribution-cpu-v0",
  );
  public static readonly GPU_V0 = new SageMakerImage(
    "sagemaker-distribution-gpu-v0",
  );
  public static readonly GPU_V1 = new SageMakerImage(
    "sagemaker-distribution-gpu-v1",
  );

  constructor(public readonly resourceId: string) {}

  public getArnForStack(stack: Stack) {
    // this maps the region to the AWS-owned account that owns the image
    const regionToAccount =
      (stack.node.tryFindChild(SageMakerImageSingletonID) as
        | CfnMapping
        | undefined) ??
      new CfnMapping(stack, SageMakerImageSingletonID, {
        // https://docs.aws.amazon.com/sagemaker/latest/dg/notebooks-available-images.html
        mapping: {
          "us-east-1": {
            account: "081325390199",
          },
          "us-east-2": {
            account: "429704687514",
          },
          "us-west-1": {
            account: "742091327244",
          },
          "us-west-2": {
            account: "236514542706",
          },
          "af-south-1": {
            account: "559312083959",
          },
          "ap-east-1": {
            account: "493642496378",
          },
          "ap-south-1": {
            account: "394103062818",
          },
          "ap-northeast-2": {
            account: "806072073708",
          },
          "ap-southeast-1": {
            account: "492261229750",
          },
          "ap-southeast-2": {
            account: "452832661640",
          },
          "ap-northeast-1": {
            account: "102112518831",
          },
          "ca-central-1": {
            account: "310906938811",
          },
          "eu-central-1": {
            account: "936697816551",
          },
          "eu-west-1": {
            account: "470317259841",
          },
          "eu-west-2": {
            account: "712779665605",
          },
          "eu-west-3": {
            account: "615547856133",
          },
          "eu-north-1": {
            account: "243637512696",
          },
          "eu-south-1": {
            account: "592751261982",
          },
          "sa-east-1": {
            account: "782484402741",
          },
          "ap-northeast-3": {
            account: "792733760839",
          },
          "ap-southeast-3": {
            account: "276181064229",
          },
          "me-south-1": {
            account: "117516905037",
          },
          "me-central-1": {
            account: "103105715889",
          },
        },
      });

    const region = stack.region;
    return Arn.format({
      partition: "aws",
      service: "sagemaker",
      region,
      account: regionToAccount.findInMap(region, "account"),
      resource: "image",
      resourceName: this.resourceId,
    });
  }
}
