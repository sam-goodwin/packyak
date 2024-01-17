from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence


if TYPE_CHECKING:
    from packyak.bucket import Bucket
    from packyak.function import LambdaFunction
    from packyak.queue import Queue
    from packyak.resource import Resource

BUCKETS: dict[str, Bucket] = {}
FUNCTIONS: dict[str, LambdaFunction[Any, Any]] = {}
QUEUES: dict[str, Queue[Any]] = {}


def lookup_function(function_id: str) -> LambdaFunction[Any, Any]:
    if function_id not in FUNCTIONS:
        raise Exception(f"Lambda Function {function_id} does not exist")
    return FUNCTIONS[function_id]


def find_all_resources() -> Sequence[Resource]:
    return list(BUCKETS.values()) + list(QUEUES.values())


def find_all_functions() -> list[LambdaFunction[Any, Any]]:
    return list(FUNCTIONS.values())
