from asyncio import AbstractEventLoop, get_event_loop, new_event_loop
from typing import Any, Coroutine, TypeVar

T = TypeVar("T")


def sync(coroutine: Coroutine[Any, Any, T]) -> T:
    loop: AbstractEventLoop = get_event_loop()
    if loop.is_closed():
        loop = new_event_loop()
    return loop.run_until_complete(coroutine)
