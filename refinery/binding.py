from typing import Any

from .function import LambdaFunction
from .resource import Resource


class Binding:
    def __init__(
        self,
        function: LambdaFunction[Any, Any],
        resource: Resource,
        scopes: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.resource = resource
        self.scopes = scopes
        self.function = function
        self.metadata = metadata
