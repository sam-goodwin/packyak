import { type Stack, CfnMapping, Arn } from "aws-cdk-lib/core";

export const SageMakerImageSingletonID = "sagemaker:image:mapping";
export const SageMakerDistributionImageSingletonID =
  "sagemaker:image:mapping:distribution";

export enum SageMakerImageType {
  DISTRIBUTION = "Distribution",
  IMAGE = "Image",
}

// AWS stores each image in a different account based on two factors:
// 1. The region
// 2. Whether it is a "Distribution Image" or a "Standard Image"
// https://docs.aws.amazon.com/sagemaker/latest/dg/notebooks-available-images.html
const imageArnAccounts = {
  "us-east-1": "081325390199",
  "us-east-2": "429704687514",
  "us-west-1": "742091327244",
  "us-west-2": "236514542706",
  "af-south-1": "559312083959",
  "ap-east-1": "493642496378",
  "ap-south-1": "394103062818",
  "ap-northeast-2": "806072073708",
  "ap-southeast-1": "492261229750",
  "ap-southeast-2": "452832661640",
  "ap-northeast-1": "102112518831",
  "ca-central-1": "310906938811",
  "eu-central-1": "936697816551",
  "eu-west-1": "470317259841",
  "eu-west-2": "712779665605",
  "eu-west-3": "615547856133",
  "eu-north-1": "243637512696",
  "eu-south-1": "592751261982",
  "sa-east-1": "782484402741",
  "ap-northeast-3": "792733760839",
  "ap-southeast-3": "276181064229",
  "me-south-1": "117516905037",
  "me-central-1": "103105715889",
};
const distributionImageArnAccounts = {
  "us-east-1": "885854791233",
  "us-east-2": "137914896644",
  "us-west-1": "053634841547",
  "us-west-2": "542918446943",
  "af-south-1": "238384257742",
  "ap-east-1": "523751269255",
  "ap-south-1": "245090515133",
  "ap-northeast-2": "064688005998",
  "ap-southeast-1": "022667117163",
  "ap-southeast-2": "648430277019",
  "ap-northeast-1": "010972774902",
  "ca-central-1": "481561238223",
  "eu-central-1": "545423591354",
  "eu-west-1": "819792524951",
  "eu-west-2": "021081402939",
  "eu-west-3": "856416204555",
  "eu-north-1": "175620155138",
  "eu-south-1": "810671768855",
  "sa-east-1": "567556641782",
  "ap-northeast-3": "564864627153",
  "ap-southeast-3": "370607712162",
  "me-south-1": "523774347010",
  "me-central-1": "358593528301",
};

export class SageMakerImage {
  public static readonly CPU_V1 = new SageMakerImage(
    "sagemaker-distribution-cpu-v1",
    SageMakerImageType.DISTRIBUTION,
  );
  public static readonly CPU_V0 = new SageMakerImage(
    "sagemaker-distribution-cpu-v0",
    SageMakerImageType.DISTRIBUTION,
  );
  public static readonly GPU_V0 = new SageMakerImage(
    "sagemaker-distribution-gpu-v0",
    SageMakerImageType.DISTRIBUTION,
  );
  public static readonly GPU_V1 = new SageMakerImage(
    "sagemaker-distribution-gpu-v1",
    SageMakerImageType.DISTRIBUTION,
  );

  constructor(
    private readonly resourceId: string,
    private readonly type: SageMakerImageType,
  ) {}

  public getArnForStack(stack: Stack) {
    const [singletonId, mappings] =
      this.type === SageMakerImageType.IMAGE
        ? [SageMakerImageSingletonID, imageArnAccounts]
        : [SageMakerDistributionImageSingletonID, distributionImageArnAccounts];

    // this maps the region to the AWS-owned account that owns the image
    const regionToAccount =
      (stack.node.tryFindChild(singletonId) as CfnMapping | undefined) ??
      new CfnMapping(stack, singletonId, {
        mapping: Object.fromEntries(
          Object.entries(mappings).map(([region, account]) => [
            region,
            { account },
          ]),
        ),
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
