export enum ComputeUnit {
  INSTANCES = "Instances",
  INSTANCE_FLEET_UNITS = "InstanceFleetUnits",
  VCPU = "VCPU",
}

export interface ManagedScalingPolicy {
  readonly computeLimits: ComputeLimits;
}

export interface ComputeLimits {
  readonly unitType: ComputeUnit;
  readonly minimumCapacityUnits: number;
  readonly maximumCapacityUnits: number;
}

export enum ScaleDownBehavior {
  TERMINATE_AT_INSTANCE_HOUR = "TERMINATE_AT_INSTANCE_HOUR",
  TERMINATE_AT_TASK_COMPLETION = "TERMINATE_AT_TASK_COMPLETION",
}
