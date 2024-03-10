import os
import asyncclick as click
from packyak.cli.cli import cli
from packyak.util.git import get_git_branch
from packyak.synth import synth


@cli.command()
@click.argument(
    "assets",
    nargs=-1,
    type=list[str],
)
@click.option(
    "--root",
    type=str,
    help="The working directory of the PackYak project. Defaults to CWD.",
)
@click.option(
    "--branch",
    type=str,
    help="Name of the data branch to materialize. Default to the branch of the current git repository.",
)
@click.option(
    "--profile",
    type=str,
    help="AWS CLI profile to use when authenticating to SSM",
)
def materialize(
    assets: list[str] = [],
    root: str = os.getcwd(),
    branch: str = get_git_branch(),
    profile: str | None = None,
):
    spec = synth(root)

    pass
