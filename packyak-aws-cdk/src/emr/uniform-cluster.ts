import { Construct } from "constructs";
import { type BaseClusterProps, Cluster } from "./cluster";
import type { InstanceGroup, PrimaryInstanceGroup } from "./instance-group";

export interface UniformClusterProps extends BaseClusterProps {
  /**
   * Describes the EC2 instances and instance configurations for the primary {@link InstanceGroup}.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-masterinstancegroup
   */
  readonly primaryInstanceGroup: PrimaryInstanceGroup;
  /**
   * Describes the EC2 instances and instance configurations for core {@link InstanceGroup}s.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-coreinstancegroup
   */
  readonly coreInstanceGroup: InstanceGroup;
  /**
   * Describes the EC2 instances and instance configurations for task {@link InstanceGroup}s.
   *
   * These task {@link InstanceGroup}s are added to the cluster as part of the cluster launch.
   * Each task {@link InstanceGroup} must have a unique name specified so that CloudFormation
   * can differentiate between the task {@link InstanceGroup}s.
   *
   * > After creating the cluster, you can only modify the mutable properties of `InstanceGroupConfig` , which are `AutoScalingPolicy` and `InstanceCount` . Modifying any other property results in cluster replacement.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-taskinstancegroups
   */
  readonly taskInstanceGroups?: InstanceGroup[];
}

/**
 * Creates an EMR Cluster that is comprised of {@link InstanceGroup}s.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-uniform-instance-group.html
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-plan-instances-guidelines.html
 */
export class UniformCluster extends Cluster {
  constructor(scope: Construct, id: string, props: UniformClusterProps) {
    super(scope, id, props);
  }
}
