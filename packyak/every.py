from packyak.runnable.function import LambdaFunction
from packyak.runnable.job import Job
from packyak.duration import TimeUnit
from typing import Any, TypeVar


T = TypeVar("T", bound=Job[Any] | LambdaFunction[[], Any])


def every(amount: int, unit: TimeUnit):
    def wrapper(func: T) -> T:
        return func

    return wrapper
