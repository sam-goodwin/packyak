from enum import Enum
from typing import Callable, TypeVar, TYPE_CHECKING

from packyak.runtime.job import Job
from packyak.spec import DependencyGroup
from packyak.resource import Resource
from pyspark import SparkContext

Return = TypeVar("Return")


class Engine(Enum):
    Spark = "SPARK"


class Cluster(Resource):
    def __init__(self, cluster_id: str):
        super().__init__(cluster_id)
        self.cluster_id = cluster_id
        self.engine = Engine.Spark

    def job(
        self,
        job_id: str | None = None,
        *,
        file_name: str | None = None,
        with_: DependencyGroup = None,
        without: DependencyGroup = None,
        # deprecated, use with_ and without
        dev: bool | None = None,
        all_extras: bool | None = None,
        without_hashes: bool | None = None,
        without_urls: bool | None = None,
    ):
        def decorator(handler: Callable[[SparkContext], Return]) -> Job[Return]:
            return Job(
                handler=handler,
                job_id=job_id,
                file_name=file_name,
                with_=with_,
                without=without,
                dev=dev,
                all_extras=all_extras,
                without_hashes=without_hashes,
                without_urls=without_urls,
            )

        return decorator
