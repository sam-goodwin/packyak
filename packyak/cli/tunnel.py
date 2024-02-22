import click

from .cli import cli


@cli.command()
def tunnel():
    click.echo("Goodbye!")
