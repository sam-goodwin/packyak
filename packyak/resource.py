from packyak.spec import ResourceType


class Resource:
    resource_type: ResourceType

    def __init__(self, resource_type: ResourceType, resource_id: str):
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.bucket_id = self.resource_id
        resources.append(self)


resources: list[Resource] = []
