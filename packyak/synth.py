import os
from typing import Any
from .bucket import Bucket
from .function import LambdaFunction
from .queue import Queue
from .reflect import find_all_functions, find_all_resources, find_bindings
from .resource import Resource
from .spec import (
    BindingSpec,
    BucketSpec,
    BucketSubscriptionSpec,
    FunctionSpec,
    QueueSpec,
    QueueSubscriptionSpec,
    PackyakSpec,
)


def synth() -> PackyakSpec:
    functions: list[FunctionSpec] = []
    buckets: list[BucketSpec] = []
    queues: list[QueueSpec] = []

    seen = set[Any]()

    def visit(resource: Resource | LambdaFunction[Any, Any]):
        if resource in seen:
            return
        seen.add(resource)

        if isinstance(resource, Bucket):
            buckets.append(
                BucketSpec(
                    bucket_id=resource.resource_id,
                    subscriptions=[
                        BucketSubscriptionSpec(
                            scope=sub.scope,  # type: ignore - sub.scope is typed properly
                            function_id=sub.function.function_id,
                        )
                        for sub in resource.subscriptions
                    ],
                )
            )
        elif isinstance(resource, Queue):
            queues.append(
                QueueSpec(
                    queue_id=resource.resource_id,
                    fifo=resource.fifo,
                    subscriptions=[
                        QueueSubscriptionSpec(function_id=sub.function.function_id)
                        for sub in resource.subscriptions
                    ],
                )
            )
        elif isinstance(resource, LambdaFunction):
            bindings = find_bindings(resource)
            functions.append(
                FunctionSpec(
                    function_id=resource.function_id,
                    file_name=resource.file_name,
                    bindings=(
                        [
                            BindingSpec(
                                resource_type=binding.resource.resource_type,
                                resource_id=binding.resource.resource_id,
                                scopes=binding.scopes,
                                props=binding.metadata,
                            )
                            for binding in find_bindings(resource)
                        ]
                        if len(bindings) > 0
                        else None
                    ),
                    with_=resource.with_,
                    without=resource.without,
                    dev=resource.dev,
                    all_extras=resource.all_extras,
                    without_hashes=resource.without_hashes,
                    without_urls=resource.without_urls,
                )
            )

    for resource in find_all_resources():
        visit(resource)

    for function in find_all_functions():
        visit(function)

    packyak_spec = PackyakSpec(
        buckets=buckets,
        queues=queues,
        functions=functions,
    )
    return packyak_spec
