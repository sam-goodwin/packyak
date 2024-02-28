from typing import Any
import boto3
from dataclasses import dataclass
from enum import Enum


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
    def __init__(self):
        self.emr = boto3.client("emr")

    def get_primary_node_instance_id(self, cluster_id: str) -> str:
        instance_id = self.try_get_primary_node_instance_id(cluster_id)
        if instance_id is None:
            raise Exception(f"No primary instance found for EMR cluster {cluster_id}")
        return instance_id

    def try_get_primary_node_instance_id(self, cluster_id: str) -> str | None:
        for group in self.emr.list_instance_groups(ClusterId=cluster_id)[
            "InstanceGroups"
        ]:
            if "InstanceGroupType" not in group:
                raise Exception("No instance group type")
            if group["InstanceGroupType"] == "MASTER":
                if "Id" not in group:
                    raise Exception("No instance group ID")
                instances = self.emr.list_instances(
                    ClusterId=cluster_id, InstanceGroupId=group["Id"]
                )["Instances"]
                if len(instances) > 0:
                    if "Ec2InstanceId" not in instances[0]:
                        raise Exception("No EC2 instance ID")
                    return instances[0]["Ec2InstanceId"]

        return None

    def list_clusters(
        self,
        active_only: bool = True,
    ):
        """
        List EMR clusters based on their states.

        :param states: A list of states to filter the clusters by. If None, all active clusters are listed.
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

        response = self.emr.list_clusters(
            ClusterStates=[state.value for state in states]
        )
        clusters = response.get("Clusters", [])

        def parse_cluster_status(cluster: Any):
            return ClusterStatus(cluster["Status"]["State"])

        def fail(msg: str):
            raise Exception(msg)

        return [
            Cluster(
                cluster_id=cluster["Id"] if "Id" in cluster else fail("No cluster ID"),
                cluster_name=cluster["Name"]
                if "Name" in cluster
                else fail("No cluster name"),
                cluster_status=parse_cluster_status(cluster),
            )
            for cluster in clusters
        ]
