from typing import TypeVar, Callable

T = TypeVar("T")


def memoize(fn: Callable[[], T]) -> Callable[[], T]:
    cache = None

    def wrapper():
        nonlocal cache
        if cache is None:
            cache = fn()
        return cache

    return wrapper
