import "./packyak-aws-cdk/lib/index";

import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { App, Stack } from "aws-cdk-lib/core";

async function Dns(this: Stack) {
  const hostedZone = new HostedZone(this, "hostedZone", {
    zoneName: "packyak.ai",
  });
  const certificate = new Certificate(this, "certificate", {
    domainName: "packyak.ai",
    validation: CertificateValidation.fromDns(hostedZone),
  });

  return {
    hostedZone,
    certificate,
  };
}

// https://spark.apache.org/docs/latest/sql-data-sources-binaryFile.html

// CDK App start here

const app = new App();

// const dns = await app.create(Dns);

// app.create(function DocsSite(this: Construct) {
//   const site = new StaticSite(this, "docs.packyak.ai", {
//     path: "docs",
//     customDomain: {
//       domainName: "docs.packyak.ai",
//       hostedZone: dns.hostedZone.hostedZoneArn,
//     },
//   });

//   return {
//     SiteUrl: site.url!,
//   };
// });
