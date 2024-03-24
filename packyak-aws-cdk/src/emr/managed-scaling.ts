import { IResolvable } from "aws-cdk-lib/core";
import { InstanceMarket } from "./instance-market";

export enum ComputeUnit {
  INSTANCES = "Instances",
  INSTANCE_FLEET_UNITS = "InstanceFleetUnits",
  VCPU = "VCPU",
}

export interface ManagedScalingPolicy {
  readonly computeLimits: ComputeLimits;
}

export interface ComputeLimits {
  /**
   * The upper boundary of Amazon EC2 units.
   *
   * It is measured through vCPU cores or instances for instance groups and measured through units for instance fleets. Managed scaling activities are not allowed beyond this boundary. The limit only applies to the core and task nodes. The master node cannot be scaled after initial configuration.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-computelimits.html#cfn-emr-cluster-computelimits-maximumcapacityunits
   */
  readonly maximumCapacityUnits: number;
  /**
   * The upper boundary of Amazon EC2 units for core node type in a cluster.
   *
   * It is measured through vCPU cores or instances for instance groups and measured through units for instance fleets. The core units are not allowed to scale beyond this boundary. The parameter is used to split capacity allocation between core and task nodes.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-computelimits.html#cfn-emr-cluster-computelimits-maximumcorecapacityunits
   */
  readonly maximumCoreCapacityUnits?: number;
  /**
   * The upper boundary of On-Demand Amazon EC2 units.
   *
   * It is measured through vCPU cores or instances for instance groups and measured through units for instance fleets. The On-Demand units are not allowed to scale beyond this boundary. The parameter is used to split capacity allocation between On-Demand and Spot Instances.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-computelimits.html#cfn-emr-cluster-computelimits-maximumondemandcapacityunits
   */
  readonly maximumOnDemandCapacityUnits?: number;
  /**
   * The lower boundary of Amazon EC2 units.
   *
   * It is measured through vCPU cores or instances for instance groups and measured through units for instance fleets. Managed scaling activities are not allowed beyond this boundary. The limit only applies to the core and task nodes. The master node cannot be scaled after initial configuration.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-computelimits.html#cfn-emr-cluster-computelimits-minimumcapacityunits
   */
  readonly minimumCapacityUnits: number;
  /**
   * The unit type used for specifying a managed scaling policy.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-computelimits.html#cfn-emr-cluster-computelimits-unittype
   */
  readonly unitType: ComputeUnit;
}

export enum ScaleDownBehavior {
  TERMINATE_AT_INSTANCE_HOUR = "TERMINATE_AT_INSTANCE_HOUR",
  TERMINATE_AT_TASK_COMPLETION = "TERMINATE_AT_TASK_COMPLETION",
}

export interface AutoScalingPolicy {
  /**
   * The upper and lower Amazon EC2 instance limits for an automatic scaling policy.
   *
   * Automatic scaling activity will not cause an instance group to grow above or below these limits.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-autoscalingpolicy.html#cfn-emr-cluster-autoscalingpolicy-constraints
   */
  readonly constraints: IResolvable | ScalingConstraints;
  /**
   * The scale-in and scale-out rules that comprise the automatic scaling policy.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-autoscalingpolicy.html#cfn-emr-cluster-autoscalingpolicy-rules
   */
  readonly rules: Array<IResolvable | ScalingRule> | IResolvable;
}

/**
 * `ScalingConstraints` is a subproperty of the `AutoScalingPolicy` property type.
 *
 * `ScalingConstraints` defines the upper and lower EC2 instance limits for an automatic scaling policy. Automatic scaling activities triggered by automatic scaling rules will not cause an instance group to grow above or shrink below these limits.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingconstraints.html
 */
export interface ScalingConstraints {
  /**
   * The upper boundary of Amazon EC2 instances in an instance group beyond which scaling activities are not allowed to grow.
   *
   * Scale-out activities will not add instances beyond this boundary.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingconstraints.html#cfn-emr-cluster-scalingconstraints-maxcapacity
   */
  readonly maxCapacity: number;
  /**
   * The lower boundary of Amazon EC2 instances in an instance group below which scaling activities are not allowed to shrink.
   *
   * Scale-in activities will not terminate instances below this boundary.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingconstraints.html#cfn-emr-cluster-scalingconstraints-mincapacity
   */
  readonly minCapacity: number;
}

/**
 * `ScalingRule` is a subproperty of the `AutoScalingPolicy` property type.
 *
 * `ScalingRule` defines the scale-in or scale-out rules for scaling activity, including the CloudWatch metric alarm that triggers activity, how EC2 instances are added or removed, and the periodicity of adjustments. The automatic scaling policy for an instance group can comprise one or more automatic scaling rules.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingrule.html
 */
export interface ScalingRule {
  /**
   * The conditions that trigger an automatic scaling activity.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingrule.html#cfn-emr-cluster-scalingrule-action
   */
  readonly action: IResolvable | ScalingAction;
  /**
   * A friendly, more verbose description of the automatic scaling rule.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingrule.html#cfn-emr-cluster-scalingrule-description
   */
  readonly description?: string;
  /**
   * The name used to identify an automatic scaling rule.
   *
   * Rule names must be unique within a scaling policy.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingrule.html#cfn-emr-cluster-scalingrule-name
   */
  readonly name: string;
  /**
   * The CloudWatch alarm definition that determines when automatic scaling activity is triggered.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingrule.html#cfn-emr-cluster-scalingrule-trigger
   */
  readonly trigger: IResolvable | ScalingTrigger;
}

/**
 * `ScalingAction` determines the type of adjustment the automatic scaling activity makes when triggered, and the periodicity of the adjustment.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingaction.html
 */
export interface ScalingAction {
  /**
   * Not available for instance groups.
   *
   * Instance groups use the market type specified for the group.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingaction.html#cfn-emr-cluster-scalingaction-market
   */
  readonly market?: InstanceMarket;
  /**
   * The type of adjustment the automatic scaling activity makes when triggered, and the periodicity of the adjustment.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingaction.html#cfn-emr-cluster-scalingaction-simplescalingpolicyconfiguration
   */
  readonly simpleScalingPolicyConfiguration: IResolvable | SimpleScalingPolicy;
}

export enum AdjustmentType {
  /**
   * The number of Amazon EC2 instances to add or remove each time the scaling activity is triggered.
   */
  CHANGE_IN_CAPACITY = "CHANGE_IN_CAPACITY",
  /**
   * The percentage of the current instance group size to add or remove each time the scaling activity is triggered.
   */
  PERCENT_CHANGE_IN_CAPACITY = "PERCENT_CHANGE_IN_CAPACITY",
  /**
   * The exact number of Amazon EC2 instances to add or remove each time the scaling activity is triggered.
   */
  EXACT_CAPACITY = "EXACT_CAPACITY",
}

/**
 * `SimpleScalingPolicyConfiguration` is a subproperty of the `ScalingAction` property type.
 *
 * `SimpleScalingPolicyConfiguration` determines how an automatic scaling action adds or removes instances, the cooldown period, and the number of EC2 instances that are added each time the CloudWatch metric alarm condition is satisfied.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-simplescalingpolicyconfiguration.html
 */
export interface SimpleScalingPolicy {
  /**
   * The way in which Amazon EC2 instances are added (if `ScalingAdjustment` is a positive number) or terminated (if `ScalingAdjustment` is a negative number) each time the scaling activity is triggered.
   *
   * `CHANGE_IN_CAPACITY` indicates that the Amazon EC2 instance count increments or decrements by `ScalingAdjustment` , which should be expressed as an integer. `PERCENT_CHANGE_IN_CAPACITY` indicates the instance count increments or decrements by the percentage specified by `ScalingAdjustment` , which should be expressed as an integer. For example, 20 indicates an increase in 20% increments of cluster capacity. `EXACT_CAPACITY` indicates the scaling activity results in an instance group with the number of Amazon EC2 instances specified by `ScalingAdjustment` , which should be expressed as a positive integer.
   *
   * @default AdjustmentType.CHANGE_IN_CAPACITY
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-simplescalingpolicyconfiguration.html#cfn-emr-cluster-simplescalingpolicyconfiguration-adjustmenttype
   */
  readonly adjustmentType?: AdjustmentType;
  /**
   * The amount of time, in seconds, after a scaling activity completes before any further trigger-related scaling activities can start.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-simplescalingpolicyconfiguration.html#cfn-emr-cluster-simplescalingpolicyconfiguration-cooldown
   */
  readonly coolDown?: number;
  /**
   * The amount by which to scale in or scale out, based on the specified `AdjustmentType` .
   *
   * A positive value adds to the instance group's Amazon EC2 instance count while a negative number removes instances. If `AdjustmentType` is set to `EXACT_CAPACITY` , the number should only be a positive integer. If `AdjustmentType` is set to `PERCENT_CHANGE_IN_CAPACITY` , the value should express the percentage as an integer. For example, -20 indicates a decrease in 20% increments of cluster capacity.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-simplescalingpolicyconfiguration.html#cfn-emr-cluster-simplescalingpolicyconfiguration-scalingadjustment
   */
  readonly scalingAdjustment: number;
}

/**
 * `ScalingTrigger` is a subproperty of the `ScalingRule` property type.
 *
 * `ScalingTrigger` determines the conditions that trigger an automatic scaling activity.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingtrigger.html
 */
export interface ScalingTrigger {
  /**
   * The definition of a CloudWatch metric alarm.
   *
   * When the defined alarm conditions are met along with other trigger parameters, scaling activity begins.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-scalingtrigger.html#cfn-emr-cluster-scalingtrigger-cloudwatchalarmdefinition
   */
  readonly cloudWatchAlarmDefinition: CloudWatchAlarmDefinition | IResolvable;
}

/**
 * `CloudWatchAlarmDefinition` is a subproperty of the `ScalingTrigger` property, which determines when to trigger an automatic scaling activity.
 *
 * Scaling activity begins when you satisfy the defined alarm conditions.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html
 */
export interface CloudWatchAlarmDefinition {
  /**
   * Determines how the metric specified by `MetricName` is compared to the value specified by `Threshold` .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-comparisonoperator
   */
  readonly comparisonOperator: string;
  /**
   * A CloudWatch metric dimension.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-dimensions
   */
  readonly dimensions?: Array<IResolvable | MetricDimension> | IResolvable;
  /**
   * The number of periods, in five-minute increments, during which the alarm condition must exist before the alarm triggers automatic scaling activity.
   *
   * The default value is `1` .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-evaluationperiods
   */
  readonly evaluationPeriods?: number;
  /**
   * The name of the CloudWatch metric that is watched to determine an alarm condition.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-metricname
   */
  readonly metricName: string;
  /**
   * The namespace for the CloudWatch metric.
   *
   * The default is `AWS/ElasticMapReduce` .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-namespace
   */
  readonly namespace?: string;
  /**
   * The period, in seconds, over which the statistic is applied.
   *
   * CloudWatch metrics for Amazon EMR are emitted every five minutes (300 seconds), so if you specify a CloudWatch metric, specify `300` .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-period
   */
  readonly period: number;
  /**
   * The statistic to apply to the metric associated with the alarm.
   *
   * The default is `AVERAGE` .
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-statistic
   */
  readonly statistic?: string;
  /**
   * The value against which the specified statistic is compared.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-threshold
   */
  readonly threshold: number;
  /**
   * The unit of measure associated with the CloudWatch metric being watched.
   *
   * The value specified for `Unit` must correspond to the units specified in the CloudWatch metric.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-cloudwatchalarmdefinition.html#cfn-emr-cluster-cloudwatchalarmdefinition-unit
   */
  readonly unit?: string;
}

/**
 * `MetricDimension` is a subproperty of the `CloudWatchAlarmDefinition` property type.
 *
 * `MetricDimension` specifies a CloudWatch dimension, which is specified with a `Key` `Value` pair. The key is known as a `Name` in CloudWatch. By default, Amazon EMR uses one dimension whose `Key` is `JobFlowID` and `Value` is a variable representing the cluster ID, which is `${emr.clusterId}` . This enables the automatic scaling rule for EMR to bootstrap when the cluster ID becomes available during cluster creation.
 *
 * @struct
 * @stability external
 * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-metricdimension.html
 */
export interface MetricDimension {
  /**
   * The dimension name.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-metricdimension.html#cfn-emr-cluster-metricdimension-key
   */
  readonly key: string;
  /**
   * The dimension value.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-metricdimension.html#cfn-emr-cluster-metricdimension-value
   */
  readonly value: string;
}
