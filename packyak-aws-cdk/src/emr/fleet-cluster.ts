import { Construct } from "constructs";
import { type BaseClusterProps, Cluster } from "./cluster";
import type { InstanceFleet } from "./instance-fleet";
import { ComputeUnit } from "./managed-scaling";

export interface FleetClusterProps extends BaseClusterProps {
  /**
   * Describes the EC2 instances and instance configurations for the primary
   * {@link InstanceFleet} when using {@link FleetCluster}s.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-masterinstancefleet
   */
  readonly primaryInstanceFleet: InstanceFleet;
  /**
   * Describes the EC2 instances and instance configurations for the core {@link InstanceFleet}.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-coreinstancefleet
   */
  readonly coreInstanceFleet: InstanceFleet;
  /**
   * Describes the EC2 instances and instance configurations for the task {@link InstanceFleet}s.
   *
   * These task {@link InstanceFleet}s are added to the cluster as part of the cluster launch.
   * Each task {@link InstanceFleet} must have a unique name specified so that CloudFormation
   * can differentiate between the task {@link InstanceFleet}s.
   *
   * > You can currently specify only one task instance fleet for a cluster. After creating the cluster, you can only modify the mutable properties of `InstanceFleetConfig` , which are `TargetOnDemandCapacity` and `TargetSpotCapacity` . Modifying any other property results in cluster replacement. > To allow a maximum of 30 Amazon EC2 instance types per fleet, include `TaskInstanceFleets` when you create your cluster. If you create your cluster without `TaskInstanceFleets` , Amazon EMR uses its default allocation strategy, which allows for a maximum of five Amazon EC2 instance types.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-jobflowinstancesconfig.html#cfn-emr-cluster-jobflowinstancesconfig-taskinstancefleets
   */
  readonly taskInstanceFleets?: InstanceFleet[];
}

/**
 * An EMR Cluster that is comprised of {@link InstanceFleet}s.
 *
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-instance-fleet.html
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/on-demand-capacity-reservations.html
 */
export class FleetCluster extends Cluster {
  constructor(scope: Construct, id: string, props: FleetClusterProps) {
    if (props.managedScalingPolicy) {
      if (
        props.managedScalingPolicy.computeLimits.unitType !==
        ComputeUnit.INSTANCE_FLEET_UNITS
      ) {
        throw new Error(
          `If you are using a FleetCluster, you must use INSTANCE_FLEET_UNITS as the ComputeLimitsUnitType`,
        );
      }
    }
    super(scope, id, props);
  }
}
