from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .bucket import Bucket
    from .function import LambdaFunction
    from .queue import Queue

BUCKETS: dict[str, Bucket] = {}
FUNCTIONS: dict[str, LambdaFunction[Any, Any]] = {}
QUEUES: dict[str, Queue[Any]] = {}
