import type { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import type { IHostedZone } from "aws-cdk-lib/aws-route53";

export interface DNSConfiguration {
  readonly certificate: ICertificate;
  readonly domainName: string;
  readonly hostedZone: IHostedZone;
}
