from typing import Any

from packyak.function import LambdaFunction
from packyak.resource import Resource
from packyak.spec import BindingSpec
from packyak.synth.loaded_module import LoadedModule


class Binding:
    def __init__(
        self,
        function: LambdaFunction[Any, Any] | LoadedModule,
        resource: Resource,
        scopes: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.resource = resource
        self.scopes = scopes
        self.function = function
        self.metadata = metadata

    def to_binding_spec(self) -> BindingSpec:
        return BindingSpec(
            resource_type=self.resource.resource_type,
            resource_id=self.resource.resource_id,
            scopes=self.scopes,
            props=self.metadata,
        )
