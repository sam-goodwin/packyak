from pydantic import Field
from typing import Any, NamedTuple, TypeVar


# Define a generic type variable
PartitionKeyValue = str | int | float | bool | None

T = TypeVar("T", bound=PartitionKeyValue)


def PartitionKey() -> Any:
    return Field(..., partition_key=True)  # type: ignore - i think pydantic actually allows this


class PartitionKeyField(NamedTuple):
    name: str
    type: type[PartitionKeyValue]
