from refinery.bucket import Bucket
from refinery.decorator import function

bucket = Bucket(name="videos")

@function()
async def upload_video(key: str, file: str):
  await bucket.put(key, file)

print(upload_video.get_free_vars()['bucket'])
# <Bucket object at 0x1040bf910>
