from packyak.cli.cli import cli
from packyak.cli.list import list
from packyak.cli.materialize import materialize
from packyak.cli.new import new
from packyak.cli.run import run
from packyak.cli.ssh import ssh
from packyak.cli.synth import synth
from packyak.cli.logs import logs
from packyak.cli.instances import instances
from packyak.cli.clusters import clusters


__all__ = [
    "cli",
    "new",
    "ssh",
    "synth",
    "run",
    "materialize",
    "list",
    "logs",
    "instances",
    "clusters",
]

cli()
