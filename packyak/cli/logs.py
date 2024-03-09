import click
from packyak.cli.cli import cli
from packyak.util.emr import EMR
import asyncio
import os


@cli.command()
@click.option(
    "--cluster-id",
    required=True,
    type=str,
    help="The unique identifier of the EMR cluster.",
)
@click.option(
    "--instance-id",
    required=True,
    type=str,
    help="The unique identifier of the EMR instance.",
)
@click.option(
    "--profile",
    required=False,
    type=str,
    default=None,
    help="The AWS profile to use for the session.",
)
@click.argument("log-files", nargs=-1, type=str)
@click.option(
    "--get",
    is_flag=True,
    help="Retrieve and display the content of the log files.",
)
def logs(
    cluster_id: str,
    instance_id: str,
    profile: str | None,
    log_files: list[str] = [],
    get: bool = False,
):
    """
    Lists all log files for a given EMR cluster and instance ID.
    """
    if profile is not None:
        os.environ["AWS_PROFILE"] = profile
    emr = EMR()

    async def list_and_print_logs():
        logs = await emr.list_logs(cluster_id, instance_id)
        import fnmatch

        filtered_logs = logs
        if log_files:
            filtered_logs = []
            for log_file_pattern in log_files:
                filtered_logs.extend(fnmatch.filter(logs, log_file_pattern))

        if get:
            log_text = await asyncio.gather(
                *[emr.get_log_text(cluster_id, log) for log in filtered_logs]
            )
            for text in log_text:
                print(text)
        else:
            for log in filtered_logs:
                print(log)

    asyncio.run(list_and_print_logs())
