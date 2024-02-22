from .cli import cli
from .new import new
from .tunnel import tunnel

__all__ = ["cli", "new", "tunnel"]

if __name__ == "__main__":
    cli()
