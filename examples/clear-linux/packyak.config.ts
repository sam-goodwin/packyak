import { ClearLinuxInstance } from "@packyak/aws-cdk";
import {
	Instance,
	InstanceClass,
	InstanceSize,
	InstanceType,
	MachineImage,
	Vpc,
} from "aws-cdk-lib/aws-ec2";
import { App, Stack } from "aws-cdk-lib/core";

const app = new App();
const stack = new Stack(app, "clear-linux", {
	env: {
		account: "134261949966",
		region: "us-west-2",
	},
});

const vpc = new Vpc(stack, "vpc", {
	maxAzs: 1,
});

new ClearLinuxInstance(stack, "instance-1", {
	vpc,
	instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
});

new Instance(stack, "instance-2", {
	vpc,
	instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
	machineImage: MachineImage.latestAmazonLinux2023({}),
});
