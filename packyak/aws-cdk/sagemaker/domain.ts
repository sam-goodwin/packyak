import { Construct } from "constructs";

import { CfnDomain } from "aws-cdk-lib/aws-sagemaker";
import { Arn, Resource, Stack } from "aws-cdk-lib/core";
import { IVpc, SubnetSelection } from "aws-cdk-lib/aws-ec2";
import {
  CompositePrincipal,
  Effect,
  IGrantable,
  IRole,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { UserProfile } from "./user-profile.js";

export enum AuthMode {
  SSO = "SSO",
  IAM = "IAM",
}

// export enum DomainEncryption {
//   KMS = "KMS",
// }

export enum AppNetworkAccessType {
  VpcOnly = "VpcOnly",
  PublicInternetOnly = "PublicInternetOnly",
}

export interface DomainProps {
  /**
   * The authentication mode for the domain.
   *
   * @default AuthMode.SSO
   */
  authMode?: AuthMode;
  /**
   * The name of the domain to create.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-sagemaker-domain.html#cfn-sagemaker-domain-domainname
   */
  domainName: string;
  /**
   * The VPC where the Domain (and its resources) will be deployed to.
   */
  vpc: IVpc;
  /**
   * The subnets to deploy the Domain to.
   *
   * @default SubnetSelection.PrimaryContainer
   */
  subnetSelection?: SubnetSelection;
  /**
   * Specifies the VPC used for non-EFS traffic.
   *
   * @default AppNetworkAccessType.PublicInternetOnly
   */
  appNetworkAccessType?: AppNetworkAccessType;

  defaultUserSettings?: DefaultUserSettings;
}

export interface DefaultUserSettings {
  /**
   * The execution role for the user.
   */
  executionRole?: IRole;
  /**
   * Whether users can access the Studio by default.
   *
   * @default true
   */
  studioWebPortal?: boolean;
}

export class Domain extends Resource {
  public readonly domainId: string;
  public readonly domainArn: string;
  public readonly domainUrl: string;
  public readonly homeEfsFileSystemId: string;
  public readonly singleSignOnManagedApplicationInstanceId: string;
  public readonly singleSignOnApplicationArn: string;

  protected readonly resource: CfnDomain;

  private readonly users: Construct;

  private readonly domainExecutionRole: Role;

  constructor(scope: Construct, id: string, props: DomainProps) {
    super(scope, id);

    this.users = new Construct(this, "Users");

    const domainExecutionRole = (this.domainExecutionRole = new Role(
      this,
      "ExecutionRole",
      {
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("sagemaker.amazonaws.com"),
          new ServicePrincipal("glue.amazonaws.com"),
        ),
      },
    ));
    // sagemaker needs permission to call GetRole and PassRole on the Role it assumed
    // e.g. arn:aws:iam::123456789012:role/role-name/SageMaker will call GetRole on arn:aws:iam::123456789012:role/role-name
    // When you run `spark` in a Jupyter notebook, it will:
    // 1. GetRole
    // 2. CreateSession
    // 3. PassRole to the Session
    domainExecutionRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["iam:GetRole", "iam:PassRole"],
        resources: [domainExecutionRole.roleArn],
      }),
    );

    this.resource = new CfnDomain(this, "Resource", {
      authMode: props.authMode ?? AuthMode.SSO,
      domainName: props.domainName,
      vpcId: props.vpc.vpcId,
      subnetIds: (props.subnetSelection
        ? props.vpc.selectSubnets(props.subnetSelection).subnets
        : props.vpc.privateSubnets
      ).map((subnet) => subnet.subnetId),
      defaultUserSettings: {
        executionRole: domainExecutionRole.roleArn,
        studioWebPortal:
          props.defaultUserSettings?.studioWebPortal ?? true
            ? "ENABLED"
            : "DISABLED",
      },
      appNetworkAccessType:
        props.appNetworkAccessType ?? AppNetworkAccessType.PublicInternetOnly,
      defaultSpaceSettings: {
        executionRole: domainExecutionRole.roleArn,
      },
    });

    this.domainId = this.resource.ref;
    this.domainArn = this.resource.attrDomainArn;
    this.domainUrl = this.resource.attrUrl;
    this.homeEfsFileSystemId = this.resource.attrHomeEfsFileSystemId;
    this.singleSignOnManagedApplicationInstanceId =
      this.resource.attrSingleSignOnManagedApplicationInstanceId;
    this.singleSignOnApplicationArn =
      this.resource.attrSingleSignOnApplicationArn;

    // TODO: should this be configurable?
    this.grantStudioAccess(domainExecutionRole);

    // TODO: should this be configurable?
    this.grantGlueInteractiveSession(domainExecutionRole);
  }

  public grantGlueInteractiveSession(grantee: IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          "glue:CreateSession",
          "glue:DeleteSession",
          "glue:GetSession",
          "glue:StopSession",
          "glue:RunStatement",
        ],
        resources: [
          Arn.format(
            {
              service: "glue",
              resource: "session",
              resourceName: "*",
            },
            Stack.of(this),
          ),
        ],
      }),
    );
  }

  public grantStudioAccess(grantee: IGrantable) {
    this.grantCreateSpace(grantee);
    this.grantCreateApp(grantee);
    this.grantDeleteSpace(grantee);
    this.grantDeleteApp(grantee);
    this.grantUpdateSpace(grantee);
    this.grantCreatePresignedDomainUrl(grantee);
    this.grantDescribeApp(grantee);
    this.grantDescribeDomain(grantee);
    this.grantDescribeSpace(grantee);
    this.grantDescribeUserProfile(grantee);
    this.grantListTags(grantee);
  }

  public grantListTags(grantee: IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["sagemaker:ListTags"],
        resources: [this.domainArn],
        effect: Effect.ALLOW,
      }),
    );
  }

  public grantCreateApp(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:CreateApp"],
      resource: "app",
    });
  }

  public grantCreatePresignedDomainUrl(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:CreatePresignedDomainUrl"],
      resource: "user-profile",
    });
  }

  public grantCreateSpace(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:CreateSpace"],
      resource: "space",
    });
  }

  public grantDeleteApp(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:DeleteApp"],
      resource: "app",
    });
  }

  public grantDeleteSpace(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:DeleteSpace"],
      resource: "space",
    });
  }

  public grantDescribeApp(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:DescribeApp"],
      resource: "app",
    });
  }

  public grantDescribeDomain(grantee: IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["sagemaker:DescribeDomain"],
        resources: [this.domainArn],
        effect: Effect.ALLOW,
      }),
    );
  }

  public grantDescribeSpace(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:DescribeSpace"],
      resource: "space",
    });
  }

  public grantDescribeUserProfile(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:DescribeUserProfile"],
      resource: "user-profile",
    });
  }

  public grantUpdateSpace(grantee: IGrantable) {
    this.grant(grantee, {
      actions: ["sagemaker:UpdateSpace"],
      resource: "space",
    });
  }

  private grant(
    grantee: IGrantable,
    props: {
      actions: string[];
      resource: string;
    },
  ) {
    grantee.grantPrincipal.addToPrincipalPolicy(
      new PolicyStatement({
        actions: props.actions,
        resources: [
          Arn.format(
            {
              service: "sagemaker",
              resource: props.resource,
              resourceName: `${this.domainId}/*`,
            },
            Stack.of(this),
          ),
        ],
        effect: Effect.ALLOW,
      }),
    );
  }

  public addUserProfile(
    username: string,
    props?: {
      executionRole?: IRole;
    },
  ): UserProfile {
    return new UserProfile(this.users, username, {
      domain: this,
      userProfileName: username,
      executionRole: props?.executionRole,
    });
  }
}
