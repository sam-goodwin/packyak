from typing import Any
from packyak.integration import Integration


class Call:
    def __init__(
        self,
        func: Integration[Any, Any],
        *,
        obj: Any = None,
        metadata: dict[str, property] | None = None,
    ):
        self.func = func
        self.obj = obj
        self.metadata = metadata
