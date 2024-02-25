from typing import Any

from packyak.runnable.function import LambdaFunction
from packyak.runnable.job import Job
from packyak.resource import Resource
from packyak.runnable.runnable import Runnable
from packyak.spec import BindingSpec
from packyak.synth.loaded_module import LoadedModule


BindingTarget = Runnable[Any, Any] | LoadedModule


class Binding:
    def __init__(
        self,
        function: BindingTarget,
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
