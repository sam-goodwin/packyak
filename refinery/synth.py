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
    Spec,
)


def synth() -> Spec:
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
            functions.append(
                FunctionSpec(
                    function_id=resource.function_id,
                    file_name=resource.file_name,
                    bindings=[
                        BindingSpec(
                            resource_type=binding.resource.resource_type,  # type: ignore - seems like a bug in the type checker
                            resource_id=binding.resource.resource_id,
                            scopes=binding.scopes,
                        )
                        for binding in find_bindings(resource)
                    ],
                )
            )

    for resource in find_all_resources():
        visit(resource)

    for function in find_all_functions():
        visit(function)

    return Spec(
        buckets=buckets,
        functions=functions,
    )
