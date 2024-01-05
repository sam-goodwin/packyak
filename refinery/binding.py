from typing import Optional

from .function import LambdaFunction
from .resource import Resource


class Binding:
    def __init__(
        self,
        from_resource: Resource,
        to_resource: LambdaFunction,
        scopes: list[str],
        *,
        selector: Optional[str] = None,
    ) -> None:
        self.from_resource = from_resource
        self.scopes = scopes
        self.to_resource = to_resource
        self.target = selector
