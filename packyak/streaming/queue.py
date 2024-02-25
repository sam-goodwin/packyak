from __future__ import annotations

import json
import os
from typing import Any, Callable, Generic, Type, TypeVar, cast

from pydantic import BaseModel

from packyak.runtime.function import LambdaFunction, function
from packyak.runtime.integration import integration
from packyak.resource import Resource
from packyak.spec import DependencyGroup
from packyak.util.fqn import get_fully_qualified_name
from packyak.util.memoize import memoize
from packyak.util.typed_resource import TypedResource

import boto3
from types_aiobotocore_sqs import SQSClient
from types_aiobotocore_sqs.type_defs import ReceiveMessageResultTypeDef


sqs = memoize(lambda: boto3.client("sqs"))  # type: ignore
session = memoize(lambda: boto3.Session())
aio_sqs = memoize(lambda: TypedResource[SQSClient](session().client("sqs")))  # type: ignore


Body = str | BaseModel

B = TypeVar("B", bound=Body)


class ReceivedMessagesEvent(Generic[B]):
    def __init__(self, messages: list[Message[B]]):
        self.messages = messages


class Message(Generic[B]):
    def __init__(self, queue: "Queue[B]", message_id: str, body: B):
        self.queue = queue
        self.message_id = message_id
        self.body = body

    async def delete(self) -> None:
        await self.queue.delete(receipt_handle=self.message_id)


class QueueSubscription:
    def __init__(
        self,
        queue: "Queue[Any]",
        function: LambdaFunction[Any, Any],
    ):
        self.queue = queue
        self.function = function


class Queue(Generic[B], Resource):
    subscriptions: list[QueueSubscription]

    def __init__(self, resource_id: str, model: Type[B] = str, fifo: bool = False):
        super().__init__(resource_id)
        self.model = model
        self.fifo = fifo
        self.subscriptions = []

    @property
    def queue_url(self):
        queue_url_env = f"{self.resource_id}_queue_url"
        queue_url = os.getenv(queue_url_env)
        if queue_url is None:
            raise ValueError(f"{queue_url_env} is not defined")
        return queue_url

    def send_sync(self, body: Body) -> None:
        sqs().send_message(QueueUrl=self.queue_url, MessageBody=to_json(body))

    @integration("write")
    async def send(self, body: Body) -> None:
        async with aio_sqs() as sqs:
            await sqs.send_message(QueueUrl=self.queue_url, MessageBody=to_json(body))

    def receive_sync(self) -> list[Message[B]]:
        return self._parse_receive(sqs().receive_message(QueueUrl=self.queue_url))

    @integration("read")
    async def receive(self) -> list[Message[B]]:
        async with aio_sqs() as sqs:
            return self._parse_receive(
                await sqs.receive_message(QueueUrl=self.queue_url)
            )

    def _parse_receive(self, response: ReceiveMessageResultTypeDef) -> list[Message[B]]:
        return [
            Message(self, msg["MessageId"], self.from_json(msg["Body"]))  # type: ignore
            for msg in response.get("Messages", [])
        ]

    @integration("delete")
    async def delete(self, receipt_handle: str) -> None:
        async with aio_sqs() as sqs:
            await sqs.delete_message(
                QueueUrl=self.queue_url, ReceiptHandle=receipt_handle
            )

    @integration("list")
    async def list(self):
        async with aio_sqs() as sqs:
            response = await sqs.list_queues()
            return response.get("QueueUrls", [])

    @integration("change_visibility")
    async def change_visibility(self, receipt_handle: str, visibility_timeout: int):
        async with aio_sqs() as sqs:
            await sqs.change_message_visibility(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=visibility_timeout,
            )

    def consumer(
        self,
        function_id: str | None = None,
        *,
        with_: DependencyGroup | None = None,
        without: DependencyGroup | None = None,
        # deprecated = None, use with_ and without
        dev: bool | None = None,
        all_extras: bool | None = None,
        without_hashes: bool | None = None,
        without_urls: bool | None = None,
    ):
        def decorate(handler: Callable[[ReceivedMessagesEvent[B]], Any]):
            from aws_lambda_typing.events.sqs import SQSEvent

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
            async def lambda_func(event: SQSEvent, context: Any):
                result = await handler(
                    ReceivedMessagesEvent(
                        messages=[
                            Message(
                                queue=self,
                                message_id=message["messageId"],
                                body=self.from_json(message["body"]),
                            )
                            for message in event["Records"]
                        ]
                    )
                )
                # TODO: adapt response
                return result

            self.subscriptions.append(QueueSubscription(self, lambda_func))

        return decorate

    def from_json(self, body: str) -> B:
        if issubclass(self.model, BaseModel):
            return cast(B, self.model.model_validate_json(body))  # type: ignore
        else:
            return json.loads(body)


def to_json(body: Body):
    if isinstance(body, BaseModel):
        return body.model_dump_json()
    else:
        return str(body)
