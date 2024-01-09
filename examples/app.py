# pylint: disable=missing-function-docstring

from yakka import Bucket
from yakka.queue import Queue, ReceivedMessagesEvent
from yakka.synth import synth


video_queue = Queue[str]("video_queue", fifo=True)

files = Bucket("files")

videos = files / "videos"


@video_queue.consumer()
async def process_video_queue(event: ReceivedMessagesEvent[str]):
    await upload("key", "val")


# @videos.on("create")
# async def process_video(event: Bucket.ObjectCreatedEvent):
#     await video_queue.send(event.key)


# @function()
# async def upload_video():
#     await upload("key", "data")


async def upload(key: str, file: str):
    await videos.put(key, file)


if __name__ == "__main__":
    spec = synth()
    print(spec.model_dump_json(indent=2))
