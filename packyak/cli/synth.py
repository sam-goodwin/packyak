import click
from packyak.cli.cli import cli
from packyak.util.git import get_git_branch
from packyak.synth import synth as _synth
import os
import sys
import aiofiles as aio
import asyncio


@click.option(
    "-c",
    "--config",
    type=str,
    help="Path to the packyak.config.py file.",
    default="./packyak.config.py",
)
@click.option(
    "--branch",
    type=str,
    help="Name of the data branch to materialize. Default to the branch of the current git repository.",
    default=get_git_branch(),
)
@click.option(
    "--profile",
    type=str,
    help="AWS CLI profile to use when authenticating to SSM",
)
@cli.command()
def synth(
    config: str,
    branch: str,
    profile: str | None,
):
    import importlib
    import importlib.util

    # Add the root directory to the path so we can import relative to the user's code
    sys.path.append(os.path.dirname(os.path.abspath(config)))

    config_module_spec = importlib.util.spec_from_file_location(
        "packyak.config", config
    )
    if config_module_spec is None:
        raise ImportError(
            f"Could not find module {config}. Please ensure the file exists and is a valid Python module."
        )
    if config_module_spec.loader is not None:
        config_module = importlib.util.module_from_spec(config_module_spec)
        config_module_spec.loader.exec_module(config_module)
    else:
        raise ImportError(
            f"Could not load module {config}. Please ensure the loader is available."
        )
    asyncio.run(async_synth())


async def async_synth():
    # Your async code here
    packyak_spec = await _synth()  # Assuming _synth can be an async function
    os.makedirs(".packyak", exist_ok=True)
    async with aio.open(os.path.join(".packyak", "manifest.json"), "w") as f:
        await f.write(packyak_spec.model_dump_json(indent=2, exclude_none=True))
