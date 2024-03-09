from typing import Any
from dataclasses import dataclass
from enum import Enum
import gzip
from typing import List
from packyak.cli.node_type import NodeType

from aiobotocore.session import get_session

session = get_session()


class ClusterStatus(Enum):
    STARTING = "STARTING"
    BOOTSTRAPPING = "BOOTSTRAPPING"
    RUNNING = "RUNNING"
    WAITING = "WAITING"
    TERMINATING = "TERMINATING"
    TERMINATED = "TERMINATED"
    TERMINATED_WITH_ERRORS = "TERMINATED_WITH_ERRORS"


@dataclass
class Cluster:
    cluster_id: str
    cluster_name: str
    cluster_status: ClusterStatus


class EMR:
    async def list_instance_ids(
        self, cluster_id: str, node_type: NodeType
    ) -> List[str]:
        """
        Get the instance IDs of nodes in an EMR cluster based on the node type.

        :param cluster_id: The unique identifier of the EMR cluster.
        :param node_type: The type of the node (primary, core, task).
        :return: A list of instance IDs.
        """
        instance_ids: list[str] = []
        async with session.create_client("emr") as emr:
            # Map NodeType to EMR instance group types
            instance_group_type = {
                "primary": "MASTER",
                "core": "CORE",
                "task": "TASK",
            }.get(node_type, None)

            if instance_group_type is None:
                raise ValueError(f"Invalid node type: {node_type}")

            response = await emr.list_instance_groups(ClusterId=cluster_id)
            for group in response["InstanceGroups"]:
                if group.get("InstanceGroupType") == instance_group_type:
                    instances_response = await emr.list_instances(
                        ClusterId=cluster_id,
                        InstanceGroupId=group["Id"],
                        InstanceStates=[
                            "AWAITING_FULFILLMENT",
                            "PROVISIONING",
                            "BOOTSTRAPPING",
                            "RUNNING",
                            "TERMINATED",
                        ],
                    )

                    for instance in instances_response["Instances"]:
                        instance_id = instance.get("Ec2InstanceId")
                        if instance_id:
                            instance_ids.append(instance_id)

        return instance_ids

    async def get_primary_node_instance_id(self, cluster_id: str) -> str:
        instance_id = await self.try_get_primary_node_instance_id(cluster_id)
        if instance_id is None:
            raise Exception(f"No primary instance found for EMR cluster {cluster_id}")
        return instance_id

    async def try_get_primary_node_instance_id(self, cluster_id: str) -> str | None:
        async with session.create_client("emr") as emr:
            response = await emr.list_instance_groups(ClusterId=cluster_id)
            for group in response["InstanceGroups"]:
                if "InstanceGroupType" not in group:
                    raise Exception("No instance group type")
                if group["InstanceGroupType"] == "MASTER":
                    if "Id" not in group:
                        raise Exception("No instance group ID")
                    instances = (
                        await emr.list_instances(
                            ClusterId=cluster_id,
                            InstanceGroupId=group["Id"],
                            InstanceStates=[
                                "AWAITING_FULFILLMENT",
                                "PROVISIONING",
                                "BOOTSTRAPPING",
                                "RUNNING",
                                "TERMINATED",
                            ],
                        )
                    )["Instances"]
                    if len(instances) > 0:
                        if "Ec2InstanceId" not in instances[0]:
                            raise Exception("No EC2 instance ID")
                        return instances[0]["Ec2InstanceId"]

        return None

    async def list_clusters(
        self,
        active_only: bool = True,
    ) -> List[Cluster]:
        """
        List EMR clusters based on their states asynchronously.

        :param active_only: If True, only active clusters are listed. Otherwise, all clusters are listed.
        :return: A list of Cluster objects representing the EMR clusters.
        """

        states = (
            [
                ClusterStatus.STARTING,
                ClusterStatus.BOOTSTRAPPING,
                ClusterStatus.RUNNING,
                ClusterStatus.WAITING,
            ]
            if active_only
            else [
                ClusterStatus.STARTING,
                ClusterStatus.BOOTSTRAPPING,
                ClusterStatus.RUNNING,
                ClusterStatus.WAITING,
                ClusterStatus.TERMINATING,
                ClusterStatus.TERMINATED,
                ClusterStatus.TERMINATED_WITH_ERRORS,
            ]
        )

        async with session.create_client("emr") as emr:
            response = await emr.list_clusters(
                ClusterStates=[state.value for state in states]
            )
            clusters = response.get("Clusters", [])

        def parse_cluster_status(cluster: Any) -> ClusterStatus:
            return ClusterStatus(cluster["Status"]["State"])

        def fail(msg: str):
            raise Exception(msg)

        return [
            Cluster(
                cluster_id=cluster.get("Id", fail("No cluster ID")),
                cluster_name=cluster.get("Name", fail("No cluster name")),
                cluster_status=parse_cluster_status(cluster),
            )
            for cluster in clusters
        ]

    _bucket_name_cache = {}

    async def get_cluster_log_uri(self, cluster_id: str) -> str:
        """
        Get the S3 location of the specified EMR cluster's logs asynchronously.
        This method caches the result to avoid repeated calls for the same cluster_id.

        :param cluster_id: The unique identifier of the EMR cluster.
        :return: The S3 URI where the cluster's logs are stored.
        """
        if cluster_id in self._bucket_name_cache:
            return self._bucket_name_cache[cluster_id]

        async with session.create_client("emr") as emr:
            try:
                cluster_description = await emr.describe_cluster(ClusterId=cluster_id)
                log_uri = cluster_description["Cluster"]["LogUri"]
                self._bucket_name_cache[cluster_id] = log_uri
                return log_uri
            except Exception as e:
                raise Exception(
                    f"Failed to get log URI for cluster {cluster_id}: {str(e)}"
                )

    async def get_bucket_name(self, cluster_id: str) -> str:
        log_uri = await self.get_cluster_log_uri(cluster_id)
        bucket_name = log_uri.split("/")[2]
        return bucket_name

    async def get_log_text(self, cluster_id: str, key: str) -> str:
        async with session.create_client("s3") as s3:
            response = await s3.get_object(
                Bucket=await self.get_bucket_name(cluster_id), Key=key
            )
            obj = await response["Body"].read()
            decompressed_data = gzip.decompress(obj)
            return decompressed_data.decode("utf-8")

    async def list_logs(self, cluster_id: str, instance_id: str) -> List[str]:
        """
        List all logs for a given EMR instance within a specified bucket.

        :param bucket_name: The name of the S3 bucket where logs are stored.
        :param instance_id: The unique identifier of the EMR instance.
        :return: A list of log file names.
        """
        log_files = []
        bucket_name = await self.get_bucket_name(cluster_id)
        async with session.create_client("s3") as s3:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(
                Bucket=bucket_name, Prefix=f"{cluster_id}/node/{instance_id}/"
            ):
                for obj in page.get("Contents", []):
                    log_files.append(obj["Key"])
        return log_files
