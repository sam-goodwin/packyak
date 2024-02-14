import { App, RemovalPolicy, Stack } from "aws-cdk-lib/core";
import {
  LakeHouse,
  Domain,
  AuthMode,
  SparkCluster,
  IcebergGlueCatalog,
} from "@packyak/aws-cdk";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { Bucket } from "aws-cdk-lib/aws-s3";

const app = new App();

const stack = new Stack(app, "streamlit-example-aws-cdk-2");

const hostedZone = HostedZone.fromHostedZoneAttributes(stack, "HostedZone", {
  hostedZoneId: "Z0142778163AZ8IIPALSQ",
  zoneName: "samgoodwin.noetikdev.com",
});

const noetikLegacy = IcebergGlueCatalog.fromBucketName(
  stack,
  "IcebergGlueCatalog",
  {
    warehouseBucketName: "noetik-data-lake-poc",
  },
);

const certificate = new Certificate(stack, "Certificate", {
  domainName: "nessie.samgoodwin.noetikdev.com",
  validation: CertificateValidation.fromDns(hostedZone),
});

const stage = process.env.STAGE ?? "personal";

const lakeHouse = new LakeHouse(stack, "DataLake", {
  removalPolicy: RemovalPolicy.DESTROY,
  lakehouseName: `streamlit-example-aws-cdk-${stage}`,
  module: "app",
  dns: {
    domainName: "nessie.samgoodwin.noetikdev.com",
    certificate,
    hostedZone,
  },
});

const domain = new Domain(stack, "Domain", {
  removalPolicy: RemovalPolicy.DESTROY,
  domainName: `streamlit-example-aws-cdk-${stage}`,
  vpc: lakeHouse.vpc,
  authMode: AuthMode.IAM,
});

const spark = new SparkCluster(stack, "SparkCluster", {
  clusterName: "streamlit-example",
  catalogs: {
    spark_catalog: lakeHouse.catalog,
    noetik_athena: noetikLegacy,
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
