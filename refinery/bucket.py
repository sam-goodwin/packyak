from typing import Generic, TypeVar

from .decorator import inflight

VideoType = TypeVar('VideoType')

class Video(Generic[VideoType]):
  pass

class Bucket:
  def __init__(self, name: str):
    self.name = name

  def bind(self, target, scope):
    target.grant(scope)
    target.add_env(self.name, self)
    pass

  @inflight("write")
  async def put(self, key: str, file: str):
    # todo: implement
    pass



