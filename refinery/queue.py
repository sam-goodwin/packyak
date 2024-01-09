from __future__ import annotations

import json
import os
from typing import Any, Callable, Optional, Type, cast

from aiobotocore.session import get_session
from pydantic import BaseModel
from types_aiobotocore_sqs import SQSClient
from refinery.function import LambdaFunction

from refinery.globals import QUEUES

from .integration import integration
from .memoize import memoize
from .resource import Resource

session: Callable[[], SQSClient] = memoize(
    lambda: cast(S3Client, get_session().create_client("sqs"))  # type: ignore
)


type Body = str | BaseModel


class ReceivedMessagesEvent[B: Body]:
    body: B


class Message[B: Body]:
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


class Queue[B: Body](Resource):
    subscriptions: list[QueueSubscription]

    def __init__(self, resource_id: str, model: Type[B] = str, fifo: bool = False):
        super().__init__("queue", resource_id)
        self.model = model
        self.fifo = fifo
        self.subscriptions = []
        if resource_id in QUEUES:
            raise Exception(f"Queue {resource_id} already exists")
        QUEUES[resource_id] = self

    @property
    def queue_url(self):
        queue_url_env = f"{self.resource_id}_queue_url"
        queue_url = os.getenv(queue_url_env)
        if queue_url is None:
            raise ValueError(f"{queue_url_env} is not defined")
        return queue_url

    @integration("write")
    async def send(self, body: Body) -> None:
        async with session() as client:
            await client.send_message(
                QueueUrl=self.queue_url, MessageBody=to_json(body)
            )

    @integration("read")
    async def receive(self) -> list[Message[B]]:
        async with session() as client:
            response = await client.receive_message(QueueUrl=self.queue_url)

            return [
                Message(self, msg["MessageId"], self.from_json(msg["Body"]))
                for msg in response.get("Messages", [])
            ]

    @integration("delete")
    async def delete(self, receipt_handle: str) -> None:
        async with session() as client:
            await client.delete_message(
                QueueUrl=self.queue_url, ReceiptHandle=receipt_handle
            )

    @integration("list")
    async def list(self):
        async with session() as client:
            response = await client.list_queues()
            return response.get("QueueUrls", [])

    @integration("change_visibility")
    async def change_visibility(self, receipt_handle: str, visibility_timeout: int):
        async with session() as client:
            await client.change_message_visibility(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=visibility_timeout,
            )

    def on(self, _path: Optional[str] = None):
        def wrap(handler: Callable[[ReceivedMessagesEvent[B]], Any]):
            pass

        return wrap

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
