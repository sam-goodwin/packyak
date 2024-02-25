from __future__ import annotations

from typing import TYPE_CHECKING, Tuple

from packyak.runtime.integration import integration

if TYPE_CHECKING:
    from packyak.storage.bucket import Bucket
    from packyak.spec import BucketSubscriptionScope
    from pyspark import SparkContext, RDD


class Folder:
    sc: SparkContext | None = None

    def __init__(self, parent: "Bucket | Folder", name: str):
        self.parent = parent
        self.name = name

    def __str__(self) -> str:
        return f"{self.bucket}{self.path}/"

    @property
    def resource_id(self) -> str:
        return self.bucket.resource_id

    @property
    def resource_type(self) -> str:
        return self.bucket.resource_type

    @property
    def path(self) -> str:
        from packyak.storage.bucket import Bucket

        if isinstance(self.parent, Bucket):
            return self.name
        else:
            return f"{self.parent.path}/{self.name}"

    @property
    def prefix(self) -> str:
        return f"{self.path}/*"

    @property
    def bucket(self) -> "Bucket":
        from packyak.storage.bucket import Bucket

        if isinstance(self.parent, Bucket):
            return self.parent
        else:
            return self.parent.bucket

    @integration("get", prefix=prefix)
    def get(self, key: str):
        return self.bucket.get(f"{self.name}/{key}")

    @integration("delete", prefix=prefix)
    def delete(self, key: str):
        return self.bucket.delete(f"{self.name}/{key}")

    @integration("put", prefix=prefix)
    def put(self, key: str, body: str):
        return self.bucket.put(f"{self.name}/{key}", body)

    @integration("list", prefix=prefix)
    async def list(self, prefix: str, *, limit: int | None, next_token: str | None):
        return self.bucket.list(
            f"{self.path}/{prefix}", limit=limit, next_token=next_token
        )

    def folder(self, path: str) -> "Folder":
        return self / path

    # Overload the '/' operator
    def __truediv__(self, other: str) -> "Folder":
        return Folder(self, other)

    def on(self, scope: BucketSubscriptionScope, prefix: str | None = None):
        return self.bucket.on(
            scope, prefix=self.path + prefix if prefix else self.path + "/*"
        )

    @integration("get", "list")
    def binaryFiles(
        self, prefix: str | None = None, *, minPartitions: int | None = None
    ) -> RDD[Tuple[str, bytes]]:
        return self.parent.binaryFiles(prefix, minPartitions=minPartitions)
