from typing import Callable, Generic, TypeVar

from .asset import AssetNode, TInput, TOutput
from .manifest import Manifest


TManifest = TypeVar("TManifest", bound=Manifest)


class MaterializedAssetNode(Generic[TInput, TOutput], AssetNode[TOutput]):
    def __init__(self, upstream: AssetNode[TInput], f: Callable[[TInput], TOutput]):
        self.upstream = upstream
        self.f = f

    def materialize(self, input: TInput) -> TOutput:
        return self.f(input)


def source(id: str, data: type[TManifest]) -> "SourceAssetNode[TManifest]":
    return SourceAssetNode[TManifest](id, data)


class SourceAssetNode(Generic[TManifest], AssetNode[TManifest]):
    def __init__(self, id: str, type: type[TManifest]):
        self.id = id
        self.type = type

    def table(self):
        def wrapper(
            f: Callable[[TManifest], TOutput],
        ) -> MaterializedAssetNode[TManifest, TOutput]:
            return MaterializedAssetNode(self, f)

        return wrapper
