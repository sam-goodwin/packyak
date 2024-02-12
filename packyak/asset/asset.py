from typing import Any, Callable, Generic, NamedTuple, TypeVar

Asset = NamedTuple

TInput = TypeVar("TInput", bound=Asset)
TOutput = TypeVar("TOutput", bound=Asset)


class AssetNode(Generic[TOutput]):
    def __init__(self, input: "AssetNode[Any]") -> None:
        self.input = input


class TableAssetNode(AssetNode[TOutput]):
    pass


def asset():
    def wrapper(func: Callable[..., Asset]):
        pass

    return wrapper
