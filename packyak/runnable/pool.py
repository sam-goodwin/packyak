from packyak.spec import ResourceType
from packyak.resource import Resource


class Pool(Resource):
    def __init__(self, pool_id: str):
        super().__init__(resource_id=pool_id, resource_type=ResourceType.Pool)
        self.name = pool_id
