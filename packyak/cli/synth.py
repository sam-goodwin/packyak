import click
from packyak.cli.cli import cli
from packyak.util.git import get_git_branch
from packyak.synth import synth as _synth
import os
import aiofiles as aio
import asyncio


@click.option("-m", type=str)
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
@cli.command()
def synth(
    root: str = os.getcwd(),
    branch: str = get_git_branch(),
    profile: str | None = None,
):
    asyncio.run(async_synth(root, branch, profile))


async def async_synth(root_dir: str, branch: str, profile: str | None):
    os.chdir(root_dir)
    print(root_dir)
    # Your async code here
    packyak_spec = await _synth(root_dir)  # Assuming _synth can be an async function
    os.makedirs(os.path.join(root_dir, ".packyak"), exist_ok=True)
    async with aio.open(os.path.join(root_dir, ".packyak", "manifest.json"), "w") as f:
        await f.write(packyak_spec.model_dump_json(indent=2))
