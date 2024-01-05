from .integration import integration
from .resource import Resource


class Bucket(Resource):
    def bind(self, target, scope):
        super().bind(target, scope)
        target.add_env(self.name, self)

    @integration("write")
    async def put(self, key: str, file: str):
        # todo: implement
        pass
