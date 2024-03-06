import type { CfnCluster } from "aws-cdk-lib/aws-emr";
import type { IMachineImage, InstanceType } from "aws-cdk-lib/aws-ec2";
import type { InstanceMarket } from "./instance-market";
import type { Configuration } from "./configuration";
import { EbsBlockDevice } from "./block-device";

export interface PrimaryInstanceGroup extends BaseInstanceGroup {
  /**
   * Number of instances in the Primary {@link InstanceGroup}.
   *
   * TODO: I need to validate if there can be more than 1 primary instance group.
   *
   * @default 1
   */
  readonly instanceCount?: number;
}

export interface InstanceGroup extends BaseInstanceGroup {
  /**
   * Target number of instances for the instance group.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-instancecount
   */
  readonly instanceCount: number;
}

interface BaseInstanceGroup {
  /**
   * `AutoScalingPolicy` is a subproperty of the [InstanceGroupConfig](https://docs.aws.amazon.com//AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig-instancegroupconfig.html) property type that specifies the constraints and rules of an automatic scaling policy in Amazon EMR . The automatic scaling policy defines how an instance group dynamically adds and terminates EC2 instances in response to the value of a CloudWatch metric. Only core and task instance groups can use automatic scaling policies. For more information, see [Using Automatic Scaling in Amazon EMR](https://docs.aws.amazon.com//emr/latest/ManagementGuide/emr-automatic-scaling.html) .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-autoscalingpolicy
   */
  readonly autoScalingPolicy?: CfnCluster.AutoScalingPolicyProperty;
  /**
   * If specified, indicates that the instance group uses Spot Instances.
   *
   * This is the maximum price you are willing to pay for Spot Instances. Specify `OnDemandPrice` to set the amount equal to the On-Demand price, or specify an amount in USD.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-bidprice
   */
  readonly bidPrice?: string;
  /**
   * > Amazon EMR releases 4.x or later.
   *
   * The list of configurations supplied for an Amazon EMR cluster instance group. You can specify a separate configuration for each instance group (master, core, and task).
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-configurations
   */
  readonly configurations?: Configuration[];
  /**
   * The custom AMI ID to use for the provisioned instance group.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-customamiid
   */
  readonly customAmi?: IMachineImage;
  /**
   * EBS {@link EbsBlockDevice}s to attach to an instance in an {@link InstanceFleet}.
   *
   * @default - No EBS block devices
   */
  readonly ebsBlockDevices?: EbsBlockDevice[];
  /**
   * An Amazon EBS–optimized instance uses an optimized configuration stack
   * and provides additional, dedicated capacity for Amazon EBS I/O. This
   * optimization provides the best performance for your EBS volumes by minimizing
   * contention between Amazon EBS I/O and other traffic from your instance.
   *
   * **Note**:
   * > For Current Generation Instance types, EBS-optimization is enabled by default at no additional cost. For Previous Generation Instances types, EBS-optimization prices are on the Previous Generation Pricing Page.
   *
   * @default true
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-optimized.html
   */
  readonly ebsOptimized?: boolean;
  /**
   * The Amazon EC2 instance type for all instances in the instance group.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-instancetype
   */
  readonly instanceType: InstanceType;
  /**
   * Market type of the Amazon EC2 instances used to create a cluster node.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-market
   */
  readonly market?: InstanceMarket;
  /**
   * Friendly name given to the instance group.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancegroupconfig.html#cfn-emr-cluster-instancegroupconfig-name
   */
  readonly name?: string;
}
