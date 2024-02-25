from typing import (
    Callable,
    TypeVar,
    TYPE_CHECKING,
)
from packyak.runnable.runnable import Runnable

from packyak.spec import DependencyGroup


# if TYPE_CHECKING:
from pyspark import SparkContext

Return = TypeVar("Return")


class Job(Runnable[[SparkContext], Return]):
    def __init__(
        self,
        handler: Callable[[SparkContext], Return],
        job_id: str | None = None,
        file_name: str | None = None,
        with_: DependencyGroup | None = None,
        without: DependencyGroup | None = None,
        dev: bool | None = None,
        all_extras: bool | None = None,
        without_hashes: bool | None = None,
        without_urls: bool | None = None,
    ) -> None:
        super().__init__(
            resource_id=job_id,
            handler=handler,
            file_name=file_name,
            with_=with_,
            without=without,
            dev=dev,
            all_extras=all_extras,
            without_hashes=without_hashes,
            without_urls=without_urls,
        )
        self.job_id = job_id
