import {
	IVpc,
	Instance,
	MachineImage,
	InstanceType,
	SubnetSelection,
	IKeyPair,
	ApplyCloudFormationInitOptions,
	BlockDevice,
	CloudFormationInit,
	ISecurityGroup,
	UserData,
} from "aws-cdk-lib/aws-ec2";
import { IRole } from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib/core";
import { Construct } from "constructs";

export interface ClearLinuxInstanceProps {
	/**
	 * Name of SSH keypair to grant access to instance
	 *
	 * @default - No SSH access will be possible.
	 * @deprecated - Use `keyPair` instead - https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2-readme.html#using-an-existing-ec2-key-pair
	 */
	readonly keyName?: string;
	/**
	 * The SSH keypair to grant access to the instance.
	 *
	 * @default - No SSH access will be possible.
	 */
	readonly keyPair?: IKeyPair;
	/**
	 * Where to place the instance within the VPC
	 *
	 * @default - Private subnets.
	 */
	readonly vpcSubnets?: SubnetSelection;
	/**
	 * In which AZ to place the instance within the VPC
	 *
	 * @default - Random zone.
	 */
	readonly availabilityZone?: string;
	/**
	 * Whether the instance could initiate connections to anywhere by default.
	 * This property is only used when you do not provide a security group.
	 *
	 * @default true
	 */
	readonly allowAllOutbound?: boolean;
	/**
	 * Whether the instance could initiate IPv6 connections to anywhere by default.
	 * This property is only used when you do not provide a security group.
	 *
	 * @default false
	 */
	readonly allowAllIpv6Outbound?: boolean;
	/**
	 * The length of time to wait for the resourceSignalCount
	 *
	 * The maximum value is 43200 (12 hours).
	 *
	 * @default Duration.minutes(5)
	 */
	readonly resourceSignalTimeout?: Duration;
	/**
	 * VPC to launch the instance in.
	 */
	readonly vpc: IVpc;
	/**
	 * Security Group to assign to this instance
	 *
	 * @default - create new security group
	 */
	readonly securityGroup?: ISecurityGroup;
	/**
	 * Type of instance to launch
	 */
	readonly instanceType: InstanceType;
	/**
	 * Specific UserData to use
	 *
	 * The UserData may still be mutated after creation.
	 *
	 * @default - A UserData object appropriate for the MachineImage's
	 * Operating System is created.
	 */
	readonly userData?: UserData;
	/**
	 * Changes to the UserData force replacement
	 *
	 * Depending the EC2 instance type, changing UserData either
	 * restarts the instance or replaces the instance.
	 *
	 * - Instance store-backed instances are replaced.
	 * - EBS-backed instances are restarted.
	 *
	 * By default, restarting does not execute the new UserData so you
	 * will need a different mechanism to ensure the instance is restarted.
	 *
	 * Setting this to `true` will make the instance's Logical ID depend on the
	 * UserData, which will cause CloudFormation to replace it if the UserData
	 * changes.
	 *
	 * @default - true iff `initOptions` is specified, false otherwise.
	 */
	readonly userDataCausesReplacement?: boolean;
	/**
	 * An IAM role to associate with the instance profile assigned to this Auto Scaling Group.
	 *
	 * The role must be assumable by the service principal `ec2.amazonaws.com`:
	 *
	 * @example
	 * const role = new iam.Role(this, 'MyRole', {
	 *   assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
	 * });
	 *
	 * @default - A role will automatically be created, it can be accessed via the `role` property
	 */
	readonly role?: IRole;
	/**
	 * The name of the instance
	 *
	 * @default - CDK generated name
	 */
	readonly instanceName?: string;
	/**
	 * Specifies whether to enable an instance launched in a VPC to perform NAT.
	 * This controls whether source/destination checking is enabled on the instance.
	 * A value of true means that checking is enabled, and false means that checking is disabled.
	 * The value must be false for the instance to perform NAT.
	 *
	 * @default true
	 */
	readonly sourceDestCheck?: boolean;
	/**
	 * Specifies how block devices are exposed to the instance. You can specify virtual devices and EBS volumes.
	 *
	 * Each instance that is launched has an associated root device volume,
	 * either an Amazon EBS volume or an instance store volume.
	 * You can use block device mappings to specify additional EBS volumes or
	 * instance store volumes to attach to an instance when it is launched.
	 *
	 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/block-device-mapping-concepts.html
	 *
	 * @default - Uses the block device mapping of the AMI
	 */
	readonly blockDevices?: BlockDevice[];
	/**
	 * Defines a private IP address to associate with an instance.
	 *
	 * Private IP should be available within the VPC that the instance is build within.
	 *
	 * @default - no association
	 */
	readonly privateIpAddress?: string;
	/**
	 * Propagate the EC2 instance tags to the EBS volumes.
	 *
	 * @default - false
	 */
	readonly propagateTagsToVolumeOnCreation?: boolean;
	/**
	 * Apply the given CloudFormation Init configuration to the instance at startup
	 *
	 * @default - no CloudFormation init
	 */
	readonly init?: CloudFormationInit;
	/**
	 * Use the given options for applying CloudFormation Init
	 *
	 * Describes the configsets to use and the timeout to wait
	 *
	 * @default - default options
	 */
	readonly initOptions?: ApplyCloudFormationInitOptions;
	/**
	 * Whether IMDSv2 should be required on this instance.
	 *
	 * @default - false
	 */
	readonly requireImdsv2?: boolean;
	/**
	 * Whether "Detailed Monitoring" is enabled for this instance
	 * Keep in mind that Detailed Monitoring results in extra charges
	 *
	 * @see http://aws.amazon.com/cloudwatch/pricing/
	 * @default - false
	 */
	readonly detailedMonitoring?: boolean;
	/**
	 * Add SSM session permissions to the instance role
	 *
	 * Setting this to `true` adds the necessary permissions to connect
	 * to the instance using SSM Session Manager. You can do this
	 * from the AWS Console.
	 *
	 * NOTE: Setting this flag to `true` may not be enough by itself.
	 * You must also use an AMI that comes with the SSM Agent, or install
	 * the SSM Agent yourself. See
	 * [Working with SSM Agent](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html)
	 * in the SSM Developer Guide.
	 *
	 * @default true
	 */
	readonly ssmSessionPermissions?: boolean;
	/**
	 * Whether to associate a public IP address to the primary network interface attached to this instance.
	 *
	 * @default - public IP address is automatically assigned based on default behavior
	 */
	readonly associatePublicIpAddress?: boolean;
}

export class ClearLinuxInstance extends Instance {
	constructor(scope: Construct, id: string, props: ClearLinuxInstanceProps) {
		super(scope, id, {
			...props,
			machineImage: MachineImage.genericLinux({
				"us-east-1": "ami-0b87c7e809831acc1",
				"us-east-2": "ami-01b13caf3090a91ab",
				"us-west-2": "ami-03997de049760762b",
				"us-west-1": "ami-092a87600ef58a870",
				// TODO: mising
			}),
			ssmSessionPermissions: props.ssmSessionPermissions ?? true,
			userData: UserData.custom(`#!/bin/bash
swupd bundle-add os-core-update
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
`),
		});
	}
}
