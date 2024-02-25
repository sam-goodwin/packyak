from packyak.runtime.function import LambdaFunction
from packyak.runtime.job import Job
from packyak.duration import TimeUnit
from typing import Any, TypeVar

T = TypeVar("T", bound=Job[Any] | LambdaFunction[[], Any])


def cron(cron: str):
    def wrapper(func: T) -> T:
        return func

    return wrapper
