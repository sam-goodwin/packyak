from typing import Any, TypeVar, AsyncContextManager

# Define a type variable for the casted type
T = TypeVar("T")


class TypedResource[T](AsyncContextManager[T]):
    def __init__(self, untyped_resource: AsyncContextManager[Any]):
        self.untyped_resource = untyped_resource
        self.typed_resource: T | None = None  # To be set in __aenter__

    async def __aenter__(self) -> T:
        # Proxy the __aenter__ call to the untyped resource, then cast it
        raw_resource = await self.untyped_resource.__aenter__()
        self.typed_resource = self.cast_to_type(raw_resource)
        return self.typed_resource

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any):
        # Proxy the __aexit__ call to the untyped resource
        await self.untyped_resource.__aexit__(exc_type, exc_val, exc_tb)

    def cast_to_type(self, resource: Any) -> T:
        # default implementation is type-only
        return resource
