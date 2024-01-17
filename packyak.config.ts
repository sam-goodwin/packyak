import "./packyak/aws-cdk/index.js";

import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { App, Stack } from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { StaticSite } from "sst/constructs";

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

// CDK App start here

const app = new App();

const dns = await app.create(Dns);

app.create(function DocsSite(this: Construct) {
  const site = new StaticSite(this, "docs.packyak.ai", {
    path: "docs",
    customDomain: {
      domainName: "docs.packyak.ai",
      hostedZone: dns.hostedZone.hostedZoneArn,
    },
  });

  return {
    SiteUrl: site.url!,
  };
});
