import click

from .cli import cli


@cli.command()
@click.option("--name", prompt="Your name", help="The person to greet.")
def new(name: str):
    click.echo(f"Hello {name}!")
