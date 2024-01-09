import os
from typing import Any, Callable, Optional, cast

from pydantic import BaseModel
from types_aiobotocore_s3 import S3Client

from .folder import Folder
from .function import LambdaFunction, function
from .globals import BUCKETS
from .integration import integration
from .memoize import memoize
from .resource import Resource
from .spec import BucketSubscriptionScope


class ObjectRef:
    def __init__(self, bucket: "Bucket", key: str, etag: str):
        self.bucket = bucket
        self.key = key
        self.etag = etag


class Object[Body]:
    def __init__(self, bucket: "Bucket", key: str, body: Body):
        self.bucket = bucket
        self.key = key
        self.body = body


s3_session = memoize(
    lambda: cast(S3Client, s3_session())  # type: ignore
)


class BucketSubscription:
    def __init__(
        self,
        bucket: "Bucket",
        scope: BucketSubscriptionScope,
        function: LambdaFunction[Any, Any],
        prefix: str | None = None,
    ):
        self.bucket = bucket
        self.scope = scope
        self.function = function
        self.prefix = prefix


class Bucket(Resource):
    subscriptions: list[BucketSubscription]

    def __init__(self, bucket_id: str):
        super().__init__("bucket", resource_id=bucket_id)
        self.subscriptions = []
        if self.resource_id in BUCKETS:
            raise Exception(f"Bucket {self.resource_id} already exists")
        BUCKETS[self.resource_id] = self

    class Event(BaseModel):
        key: str
        etag: str

    class ObjectCreatedEvent(Event):
        size: int | None

    class ObjectDeletedEvent(Event):
        pass

    # Overload the '/' operator
    def __truediv__(self, name: str) -> Folder:
        return self.folder(name)

    def folder(self, name: str) -> Folder:
        _folder: Optional[Folder] = None
        for path_component in name.split("/"):
            if _folder is None:
                _folder = Folder(self, path_component)
            else:
                _folder = _folder / path_component
        return cast(Folder, _folder)

    @property
    def bucket_name(self):
        bucket_name_env = f"{self.resource_id}_bucket_name"
        bucket_name = os.getenv(bucket_name_env)
        if bucket_name is None:
            raise ValueError(f"{bucket_name_env} is not defined")
        return bucket_name

    @integration("write")
    async def put(self, key: str, body: str):
        async with s3_session() as client:
            await client.put_object(Bucket=self.bucket_name, Key=key, Body=body)

    @integration("read")
    async def get(self, key: str):
        async with s3_session() as client:
            response = await client.get_object(Bucket=self.bucket_name, Key=key)
            return response["Body"], response["ETag"]

    @integration("delete")
    async def delete(self, key: str):
        async with s3_session() as client:
            await client.delete_object(Bucket=self.bucket_name, Key=key)

    @integration("list")
    async def list(
        self, prefix: str, *, limit: int | None, next_token: Optional[str] = None
    ) -> tuple[list[ObjectRef], Optional[str]]:
        async with s3_session() as client:
            response = await client.list_objects_v2(
                Bucket=self.bucket_name,
                MaxKeys=limit or 100,
                ContinuationToken=cast(str, next_token or None),
                Prefix=prefix,
            )
            response.get("Contents", [])[0]["Key"]
            return [
                ObjectRef(self, obj_ref["Key"], obj_ref["ETag"])
                for obj_ref in response.get("Contents", [])
            ], response.get("NextContinuationToken")

    def on(
        self,
        scope: BucketSubscriptionScope,
        prefix: Optional[str] = None,
        function_id: str | None = None,
    ):
        def decorate(handler: Callable[[Bucket.ObjectCreatedEvent], Any]):
            from aws_lambda_typing.events.event_bridge import EventBridgeEvent
            from aws_lambda_typing.events.s3 import S3

            # see https://kevinhakanson.com/2022-04-10-python-typings-for-aws-lambda-function-events/
            @function(function_id=function_id or handler.__name__)
            async def lambda_func(event: EventBridgeEvent, context: Any):
                event_detail = S3(event["detail"])  # type: ignore
                result = await handler(
                    Bucket.ObjectCreatedEvent(
                        key=event_detail["object"]["key"],  # type: ignore
                        etag=event_detail["object"]["etag"],  # type: ignore
                        size=event_detail["object"]["size"],  # type: ignore
                    )
                )
                return result

            self.subscriptions.append(
                BucketSubscription(self, scope, lambda_func, prefix)
            )

            return lambda_func

        return decorate
