import click
from packyak.cli.cli import cli
from packyak.util.git import get_git_branch


@cli.command()
@click.argument("root_dir", type=str)
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
@click.option(
    "--asset",
    multiple=True,
    type=str,
    help="List of assets to materialize. Can be specified multiple times. Defaults to all.",
)
def run(
    root_dir: str,
    branch: str = get_git_branch(),
    profile: str | None = None,
    assets: list[str] = [],
):
    pass
