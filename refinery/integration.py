from typing import Callable, Protocol, runtime_checkable
from .function import Params, Return


@runtime_checkable
class Integration(Protocol[Params, Return], Callable[Params, Return]):
    scopes: list[str]


def integration(*scopes: str):
    def function(func: Callable[Params, Return]) -> Integration[Params, Return]:
        func.scopes = scopes
        return func

    return function
