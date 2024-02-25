import os
from datetime import datetime
from typing import (
    IO,
    Any,
    Callable,
    Generic,
    Optional,
    TypeVar,
    cast,
    List,
    Tuple,
)

from pydantic import BaseModel
from packyak.util.fqn import get_fully_qualified_name
from packyak.util.memoize import memoize
from packyak.util.typed_resource import TypedResource
from packyak.storage.folder import Folder
from packyak.runtime.function import LambdaFunction, function
from packyak.runtime.integration import integration
from packyak.spec import BucketSubscriptionScope, DependencyGroup
from packyak.resource import Resource

import aioboto3
import boto3
from botocore.response import StreamingBody
from types_aiobotocore_s3.client import S3Client
from types_aiobotocore_s3.type_defs import ListObjectsV2OutputTypeDef

from pyspark import SparkContext, RDD


s3 = memoize(lambda: boto3.client("s3"))
session = memoize(lambda: aioboto3.Session())
aio_s3 = memoize(lambda: TypedResource[S3Client](session().client("s3")))  # type: ignore


class ObjectRef:
    def __init__(self, bucket: "Bucket", key: str, etag: str):
        self.bucket = bucket
        self.key = key
        self.etag = etag
        self.created_at = datetime.now()

    def __hash__(self):
        return hash((self.bucket.bucket_id, self.key, self.etag, self.created_at))


Body = TypeVar("Body", bound=Any)


class Object(Generic[Body], ObjectRef):
    def __init__(self, bucket: "Bucket", key: str, body: Body, etag: str):
        super().__init__(bucket, key, etag)
        self.body = body


class ListObjectsResponse:
    def __init__(
        self, bucket: "Bucket", objects: list[ObjectRef], next_token: str | None
    ):
        self.bucket = bucket
        self.objects = objects
        self.next_token = next_token

    def __aiter__(self):
        return self

    async def __anext__(self):
        pass


class BucketSubscription:
    def __init__(
        self,
        bucket: "Bucket",
        scopes: List[BucketSubscriptionScope],
        function: LambdaFunction[Any, Any],
        prefix: str | None = None,
    ):
        self.bucket = bucket
        self.scopes = scopes
        self.function = function
        self.prefix = prefix


Blob = str | bytes | IO[Any] | StreamingBody


class Bucket(Resource):
    subscriptions: list[BucketSubscription]

    sc: SparkContext

    def __init__(self, bucket_id: str):
        super().__init__(bucket_id)
        self.subscriptions = []

    class Event(BaseModel):
        key: str
        etag: str

    class ObjectCreatedEvent(Event):
        size: int | None

    class ObjectDeletedEvent(Event):
        pass

    def __str__(self) -> str:
        return f"s3://{self.bucket_name}/"

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

    def put_sync(self, key: str, body: Blob):
        return s3().put_object(Bucket=self.bucket_name, Key=key, Body=body)

    @integration("put")
    async def put(self, key: str, body: Blob):
        async with aio_s3() as s3:
            await s3().put_object(Bucket=self.bucket_name, Key=key, Body=body)  # type: ignore

    @integration("get")
    def get_sync(self, key: str) -> Object[StreamingBody]:
        response = s3().get_object(Bucket=self.bucket_name, Key=key)
        return Object(
            bucket=self,
            key=key,
            body=response["Body"],
            etag=response["ETag"],
        )

    @integration("get")
    async def get(self, key: str) -> Object[StreamingBody]:
        async with aio_s3() as s3:
            response = await s3.get_object(Bucket=self.bucket_name, Key=key)
            return Object(
                bucket=self,
                key=key,
                body=response["Body"],
                etag=response["ETag"],
            )

    @integration("delete")
    def delete_sync(self, key: str):
        s3().delete_object(Bucket=self.bucket_name, Key=key)

    @integration("delete")
    async def delete(self, key: str):
        async with aio_s3() as s3:
            await s3.delete_object(Bucket=self.bucket_name, Key=key)

    @integration("list")
    def list_sync(
        self, prefix: str, *, limit: int | None, next_token: str | None = None
    ):
        response = s3().list_objects_v2(
            Bucket=self.bucket_name,
            MaxKeys=limit or 100,
            ContinuationToken=cast(str, next_token or None),
            Prefix=prefix,
        )
        return self.parse_list_objects_v2_response(response)

    @integration("list")
    async def list(
        self, prefix: str, *, limit: int | None, next_token: str | None = None
    ):
        async with aio_s3() as client:
            response = await client.list_objects_v2(
                Bucket=self.bucket_name,
                MaxKeys=limit or 100,
                ContinuationToken=cast(str, next_token or None),
                Prefix=prefix,
            )
            return self.parse_list_objects_v2_response(response)

    def parse_list_objects_v2_response(
        self, response: ListObjectsV2OutputTypeDef
    ) -> ListObjectsResponse:
        return ListObjectsResponse(
            bucket=self,
            objects=[
                ObjectRef(self, obj_ref["Key"], obj_ref["ETag"])  # type: ignore
                for obj_ref in response.get("Contents", [])
            ],
            next_token=response.get("NextContinuationToken"),
        )

    def on(
        self,
        scope: BucketSubscriptionScope | List[BucketSubscriptionScope],
        prefix: Optional[str] = None,
        function_id: Optional[str] = None,
        *,
        with_: Optional[DependencyGroup] = None,
        without: DependencyGroup | None = None,
        # deprecated = None, use with_ and without
        dev: bool | None = None,
        all_extras: bool | None = None,
        without_hashes: bool | None = None,
        without_urls: bool | None = None,
    ):
        def decorate(handler: Callable[[Bucket.ObjectCreatedEvent], Any]):
            from aws_lambda_typing.events.event_bridge import EventBridgeEvent
            from aws_lambda_typing.events.s3 import S3

            # see https://kevinhakanson.com/2022-04-10-python-typings-for-aws-lambda-function-events/
            @function(
                file_name=handler.__code__.co_filename,
                function_id=(
                    function_id
                    if function_id is not None
                    else get_fully_qualified_name(handler)
                ),
                with_=with_,
                without=without,
                dev=dev,
                all_extras=all_extras,
                without_hashes=without_hashes,
                without_urls=without_urls,
            )
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
                BucketSubscription(
                    self,
                    scope if isinstance(scope, List) else [scope],
                    lambda_func,
                    prefix,
                )
            )

            return lambda_func

        return decorate

    @integration("get", "list")
    def binaryFiles(
        self, prefix: str | None = None, *, minPartitions: int | None = None
    ) -> RDD[Tuple[str, bytes]]:
        return self.sc.binaryFiles(
            f"s3://{self.bucket_name}/{prefix or ''}", minPartitions=minPartitions
        )
