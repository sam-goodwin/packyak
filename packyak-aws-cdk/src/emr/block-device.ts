import type { EbsDeviceVolumeType } from "aws-cdk-lib/aws-ec2";

/**
 * @see https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-plan-storage.html
 */
export interface EbsBlockDevice {
  /**
   * The number of I/O operations per second (IOPS) that the volume supports.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-volumespecification.html#cfn-emr-cluster-volumespecification-iops
   */
  readonly iops?: number;
  /**
   * The volume size, in gibibytes (GiB).
   *
   * This can be a number from 1 - 1024. If the volume type is EBS-optimized, the minimum value is 10.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-volumespecification.html#cfn-emr-cluster-volumespecification-sizeingb
   */
  readonly sizeInGb: number;
  /**
   * The throughput, in mebibyte per second (MiB/s).
   *
   * This optional parameter can be a number from `125` - `1000` and is valid
   * only for {@link EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3} volumes.
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-volumespecification.html#cfn-emr-cluster-volumespecification-throughput
   */
  readonly throughput?: number;
  /**
   * The volume type.
   *
   * Volume types supported are:
   * - gp3 ({@link EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3})
   * - gp2 ({@link EbsDeviceVolumeType.GENERAL_PURPOSE_SSD})
   * - io1 ({@link EbsDeviceVolumeType.PROVISIONED_IOPS_SSD})
   * - st1 ({@link EbsDeviceVolumeType.THROUGHPUT_OPTIMIZED_HDD})
   * - sc1 ({@link EbsDeviceVolumeType.COLD_HDD})
   * - standard ({@link EbsDeviceVolumeType.STANDARD})
   *
   * @see http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-emr-cluster-volumespecification.html#cfn-emr-cluster-volumespecification-volumetype
   * @default standard
   */
  readonly volumeType: EbsDeviceVolumeType;
  /**
   * The number of EBS volumes with a specific volume configuration to attach to each instance.
   *
   * @default 1
   */
  readonly volumesPerInstance?: number;
}
