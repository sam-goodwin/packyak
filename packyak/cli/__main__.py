from .cli import cli
from .new import new
from .ssh import ssh

__all__ = ["cli", "new", "ssh"]

if __name__ == "__main__":
    cli()
