from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel

type BucketSubscriptionScope = Literal["create"] | Literal["update"] | Literal["delete"]

type ResourceType = Literal["bucket"] | Literal["queue"] | Literal["function"]


class BindingSpec(BaseModel):
    resource_type: ResourceType
    resource_id: str
    scopes: list[str]
    props: dict[str, str] | None


class BucketBindingSpec(BindingSpec):
    selector: Optional[str]


class FunctionSpec(BaseModel):
    function_id: str
    file_name: str
    bindings: list[BindingSpec]


class BucketSubscriptionSpec(BaseModel):
    scope: BucketSubscriptionScope
    function_id: str


class BucketSpec(BaseModel):
    bucket_id: str
    subscriptions: list[BucketSubscriptionSpec]


class QueueSubscriptionSpec(BaseModel):
    function_id: str


class QueueSpec(BaseModel):
    queue_id: str
    fifo: bool
    subscriptions: list[QueueSubscriptionSpec]


class PackyakSpec(BaseModel):
    buckets: list[BucketSpec]
    queues: list[QueueSpec]
    functions: list[FunctionSpec]
