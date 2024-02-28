import click
import os
from tabulate import tabulate

from packyak.cli.cli import cli
from packyak.util.emr import EMR


@cli.command()
@click.option(
    "--profile", type=str, help="AWS CLI profile to use when authenticating to SSM"
)
@click.option("-v", "--verbose", type=str, is_flag=True)
def list(profile: str | None, verbose: bool = False):
    if profile is not None:
        os.environ["AWS_PROFILE"] = profile

    emr = EMR()

    try:
        clusters = emr.list_clusters(active_only=True)
        if len(clusters) > 0:
            print(
                tabulate(
                    [
                        [
                            cluster.cluster_id,
                            cluster.cluster_name,
                            cluster.cluster_status.value,
                        ]
                        for cluster in clusters
                    ],
                    # headers=["Cluster ID", "Cluster Name", "Cluster Status"],
                    headers=[],
                    tablefmt="plain",
                )
            )
        else:
            pass
    except Exception as e:
        raise click.ClickException(f"Error listing EMR clusters: {e}")
