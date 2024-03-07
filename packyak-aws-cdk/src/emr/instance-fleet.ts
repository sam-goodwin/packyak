import type { Duration } from "aws-cdk-lib/core";
import type { InstanceType, IMachineImage } from "aws-cdk-lib/aws-ec2";
import type { EbsBlockDevice } from "./block-device";

export interface InstanceFleet {
  /**
   * The name of the InstanceFleet.
   */
  readonly name: string;
  /**
   * The target capacity of On-Demand units for the instance fleet, which determines how
   * many On-Demand instances to provision. When the instance fleet launches, Amazon EMR
   * tries to provision On-Demand instances as specified by {@link instanceTypes}.
   *
   * Each {@link InstanceTypeConfig} has a specified {@link InstanceTypeConfig.weightedCapacity}.
   * When an On-Demand instance is provisioned, the {@link InstanceTypeConfig.weightedCapacity}
   * units count toward the target capacity.
   *
   * Amazon EMR provisions instances until the target capacity is totally fulfilled, even
   * if this results in an overage. For example, if there are 2 units remaining to fulfill
   * capacity, and Amazon EMR can only provision an instance with a `WeightedCapacity` of 5
   * units, the instance is provisioned, and the target capacity is exceeded by 3 units.
   *
   * > If not specified or set to 0, only Spot instances are provisioned for the instance fleet
   * using `TargetSpotCapacity` . At least one of `TargetSpotCapacity` and `TargetOnDemandCapacity`
   * should be greater than 0. For a master instance fleet, only one of `TargetSpotCapacity` and
   * `TargetOnDemandCapacity` can be specified, and its value must be 1.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancefleetconfig.html#cfn-emr-cluster-instancefleetconfig-targetondemandcapacity
   */
  readonly targetOnDemandCapacity?: number;
  /**
   * The target capacity of Spot units for the instance fleet, which determines how many Spot
   * instances to provision.
   *
   * When the instance fleet launches, Amazon EMR tries to provision Spot instances as specified by
   * {@link InstanceTypeConfig}. Each instance configuration has a specified `WeightedCapacity`. When a Spot instance is provisioned, the `WeightedCapacity` units count toward the target capacity. Amazon EMR provisions instances until the target capacity is totally fulfilled, even if this results in an overage. For example, if there are 2 units remaining to fulfill capacity, and Amazon EMR can only provision an instance with a `WeightedCapacity` of 5 units, the instance is provisioned, and the target capacity is exceeded by 3 units.
   *
   * > If not specified or set to 0, only On-Demand instances are provisioned for the instance fleet. At least one of `TargetSpotCapacity` and `TargetOnDemandCapacity` should be greater than 0. For a master instance fleet, only one of `TargetSpotCapacity` and `TargetOnDemandCapacity` can be specified, and its value must be 1.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancefleetconfig.html#cfn-emr-cluster-instancefleetconfig-targetspotcapacity
   */
  readonly targetSpotCapacity?: number;
  /**
   * The instance types and their weights to use for the InstanceFleet.
   */
  readonly instanceTypes: InstanceTypeConfig[];
  /**
   * The allocation strategy to use when provisioning Spot Instances.
   *
   * @default AllocationStrategy.PRICE_CAPACITY_OPTIMIZED
   */
  readonly allocationStrategy?: AllocationStrategy;
  /**
   * The action to take when provisioning a Cluster and Spot Instances are not available.
   *
   * @default SWITCH_TO_ON_DEMAND
   * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_SpotProvisioningSpecification.html
   */
  readonly timeoutAction?: TimeoutAction;
  /**
   * The action to take when TargetSpotCapacity has not been fulfilled when
   * the TimeoutDurationMinutes has expired; that is, when all Spot Instances
   * could not be provisioned within the Spot provisioning timeout. Valid
   * values are {@link TimeoutAction.TERMINATE_CLUSTER} and {@link TimeoutAction.SWITCH_TO_ON_DEMAND}.
   *
   * {@link TimeoutAction.SWITCH_TO_ON_DEMAND} specifies that if no Spot Instances
   * are available, On-Demand Instances should be provisioned to fulfill any
   * remaining Spot capacity.
   *
   * The minimum is `5` minutes and the maximum is `24` hours.
   *
   * @default - 1 hour
   * @see {@link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-spotprovisioningspecification.html#cfn-emr-cluster-spotprovisioningspecification-timeoutaction}
   */
  readonly timeoutDuration?: Duration;
}

/**
 * When you use allocation strategy, your On-Demand Instances use the lowest-price strategy.
 * This launches the lowest-priced instances first.
 *
 * When you launch On-Demand Instances, you can use open or targeted capacity reservations
 * in your accounts. You can use open capacity reservations for primary, core, and task nodes.
 *
 * You might experience insufficient capacity with On-Demand Instances with allocation
 * strategy for instance fleets. We recommend that you specify a larger number of instance
 * types to diversify and reduce the chance of experiencing insufficient capacity.
 *
 * For more information, see [Use capacity reservations with instance fleets](https://docs.aws.amazon.com/emr/latest/ManagementGuide/on-demand-capacity-reservations.html).
 *
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-instance-fleet.html#emr-instance-fleet-allocation-strategy
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/managed-scaling-allocation-strategy.html
 */
export enum AllocationStrategy {
  /**
   * The capacity-optimized allocation strategy launches Spot Instances into the
   * most available pools with the lowest chance of interruption in the near term.
   *
   * This is a good option for workloads that might have a higher cost of
   * interruption associated with work that gets restarted.
   */
  CAPACITY_OPTIMIZED = "capacity-optimized",
  /**
   * The price-capacity optimized allocation strategy launches Spot instances from
   * the Spot instance pools that have the highest capacity available and the
   * lowest price for the number of instances that are launching.
   *
   * As a result, the price-capacity optimized strategy typically has a higher chance
   * of getting Spot capacity, and delivers lower interruption rates.
   *
   * @recommended
   */
  PRICE_CAPACITY_OPTIMIZED = "price-capacity-optimized",
  /**
   * With the diversified allocation strategy, Amazon EC2 distributes Spot Instances
   * across all Spot capacity pools.
   */
  DIVERSIFIED = "diversified",
  /**
   * The lowest-price allocation strategy launches Spot Instances from the lowest
   * priced pool that has available capacity.
   *
   * If the lowest-priced pool doesn't have available capacity, the Spot Instances
   * come from the next lowest priced pool that has available capacity.
   *
   * If a pool runs out of capacity before it fulfills your requested capacity,
   * the Amazon EC2 fleet draws from the next lowest priced pool to continue to
   * fulfill your request.
   *
   * To ensure that your desired capacity is met, you might receive Spot Instances
   * from several pools.
   *
   * Because this strategy only considers instance price, and does not consider
   * capacity availability, it might lead to high interruption rates.
   */
  LOWEST_PRICE = "lowest-price",
}

/**
 * Action to take when provisioning a Cluster and Spot Instances are not available.
 *
 * @see https://docs.aws.amazon.com/emr/latest/APIReference/API_SpotProvisioningSpecification.html
 */
export enum TimeoutAction {
  /**
   * Specifies that if no Spot Instances are available, On-Demand Instances
   * should be provisioned to fulfill any remaining Spot capacity.
   */
  SWITCH_TO_ON_DEMAND = "SWITCH_TO_ON_DEMAND",
  /**
   * Terminates the Cluster if Spot Instances are not available.
   */
  TERMINATE_CLUSTER = "TERMINATE_CLUSTER",
}

export interface InstanceTypeConfig {
  readonly instanceType: InstanceType;
  /**
   * The custom AMI to use for the InstanceFleet.
   *
   * @default - The default Amazon EMR AMI for the specified release label.
   */
  readonly customAmi?: IMachineImage;
  /**
   * The number of units that a provisioned instance of this type provides
   * toward fulfilling the target capacities defined in `InstanceFleetConfig`.
   *
   * This value is `1` for a master instance fleet, and must be 1 or greater for
   * core and task instance fleets. Defaults to 1 if not specified.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancetypeconfig.html#cfn-emr-cluster-instancetypeconfig-weightedcapacity
   * @default 1
   */
  readonly weightedCapacity?: number;
  /**
   * The bid price for each Amazon EC2 Spot Instance type as defined by {@link InstanceType} .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancetypeconfig.html#cfn-emr-cluster-instancetypeconfig-bidprice
   */
  readonly bidPrice?: string;
  /**
   * The bid price, as a percentage of On-Demand price, for each Amazon EC2 Spot Instance
   * as defined by {@link InstanceType}.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-instancetypeconfig.html#cfn-emr-cluster-instancetypeconfig-bidpriceaspercentageofondemandprice
   */
  readonly bidPriceAsPercentageOfOnDemandPrice?: number;
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
}
