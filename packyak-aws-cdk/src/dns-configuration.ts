import type { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import type { IHostedZone } from "aws-cdk-lib/aws-route53";

export interface DNSConfiguration {
  certificate: ICertificate;
  domainName: string;
  hostedZone: IHostedZone;
}
