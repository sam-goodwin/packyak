from typing import Callable, ParamSpec, TypeVar, Generic
from packyak.resource import Resource
from packyak.util.fqn import get_fully_qualified_name
from packyak.spec import DependencyGroup

Params = ParamSpec("Params")
Return = TypeVar("Return")


class Runnable(Resource, Generic[Params, Return]):
    def __init__(
        self,
        handler: Callable[Params, Return],
        resource_id: str | None,
        file_name: str | None,
        with_: DependencyGroup | None,
        without: DependencyGroup | None,
        dev: bool | None,
        all_extras: bool | None,
        without_hashes: bool | None,
        without_urls: bool | None,
    ):
        super().__init__(
            resource_id=resource_id or get_fully_qualified_name(handler),
        )
        self.file_name = file_name or handler.__code__.co_filename
        self.handler = handler
        self.with_ = with_
        self.without = without
        self.dev = dev
        self.all_extras = all_extras
        self.without_hashes = without_hashes
        self.without_urls = without_urls
