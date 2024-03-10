import asyncclick as click
from packyak.cli.cli import cli
from packyak.util.emr import EMR, NodeType
import os


@cli.command()
@click.argument(
    "cluster_id",
    required=True,
    type=str,
)
@click.option(
    "--node-type",
    type=click.Choice(["primary", "core", "task"], case_sensitive=False),
    default=None,
    help="The node type to filter by.",
)
@click.option(
    "--profile",
    required=False,
    type=str,
    default=None,
    help="The AWS profile to use for the session.",
)
async def instances(cluster_id: str, node_type: NodeType | None, profile: str | None):
    """
    Lists instances in an EMR cluster with optional filtering by node type.
    """
    if profile is not None:
        os.environ["AWS_PROFILE"] = profile
    emr = EMR()

    if node_type is None:
        types_to_fetch: list[NodeType] = ["primary", "core", "task"]
    else:
        types_to_fetch = [node_type]

    output_messages = []
    for node_type in types_to_fetch:
        instances = await emr.list_instance_ids(cluster_id, node_type)
        if instances:
            output_messages.append(f"{node_type.capitalize()}:")
            for instance in instances:
                output_messages.append(instance)

    for message in output_messages:
        click.echo(message)
