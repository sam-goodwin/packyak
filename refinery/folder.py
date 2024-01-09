from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from refinery.bucket import Bucket, BucketSubscriptionScope


class Folder:
    def __init__(self, parent: "Bucket | Folder", name: str):
        self.parent = parent
        self.name = name

    @property
    def path(self) -> str:
        from .bucket import Bucket

        if isinstance(self.parent, Bucket):
            return self.name
        else:
            return f"{self.parent.path}/{self.name}"

    @property
    def bucket(self) -> "Bucket":
        from .bucket import Bucket

        if isinstance(self.parent, Bucket):
            return self.parent
        else:
            return self.parent.bucket

    def get(self, key: str):
        return self.bucket.get(f"{self.name}/{key}")

    def delete(self, key: str):
        return self.bucket.delete(f"{self.name}/{key}")

    def put(self, key: str, body: str):
        return self.bucket.put(f"{self.name}/{key}", body)

    async def list(self, prefix: str, *, limit: int | None, next_token: str | None):
        return self.bucket.list(
            f"{self.path}/{prefix}", limit=limit, next_token=next_token
        )

    def folder(self, path: str) -> "Folder":
        return self / path

    # Overload the '/' operator
    def __truediv__(self, other: str) -> "Folder":
        return Folder(self, other)

    def on(self, scope: BucketSubscriptionScope, prefix: Optional[str] = None):
        return self.bucket.on(
            scope, prefix=self.path + prefix if prefix else self.path + "/*"
        )
