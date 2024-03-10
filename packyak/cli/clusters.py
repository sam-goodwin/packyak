import asyncclick as click
import os
from packyak.util.emr import EMR, ClusterStatus
from tabulate import tabulate
from packyak.cli.cli import cli

from fnmatch import fnmatch


@cli.command()
@click.option(
    "--status",
    required=False,
    type=str,
    default="STARTING,BOOTSTRAPPING,RUNNING,WAITING",
    help="Comma-separated list of cluster statuses to include in the list. Allowed values are STARTING, BOOTSTRAPPING, RUNNING, WAITING, TERMINATING, TERMINATED, and TERMINATED_WITH_ERRORS.",
)
@click.option(
    "--profile",
    required=False,
    type=str,
    default=None,
    help="The AWS profile to use for the session.",
)
@click.option(
    "--filter",
    required=False,
    type=str,
    default="*",
    help="Glob pattern to filter clusters by name.",
)
async def clusters(status: str, profile: str | None, filter: str):
    """
    Lists all clusters in the account. By default, it only lists clusters that are waiting, bootstrapping, running, etc.
    Filters clusters by name using a glob pattern if provided.
    """
    if profile is not None:
        os.environ["AWS_PROFILE"] = profile
    emr = EMR()

    status_filters = [ClusterStatus[s] for s in status.split(",")]
    all_clusters = await emr.list_clusters(states=status_filters)
    filtered_clusters = [
        cluster for cluster in all_clusters if fnmatch(cluster.cluster_name, filter)
    ]
    click.echo(
        tabulate(
            [
                [
                    cluster.cluster_name,
                    cluster.cluster_id,
                    cluster.cluster_status.value,
                ]
                for cluster in filtered_clusters
            ],
            headers=[],
            tablefmt="plain",
        )
    )
