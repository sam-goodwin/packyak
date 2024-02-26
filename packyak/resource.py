class Resource:
    def __init__(self, resource_id: str):
        self.resource_id = resource_id
        self.bucket_id = self.resource_id
        if resource_id in RESOURCES:
            raise ValueError(f"Resource with id {resource_id} already exists")
        RESOURCES[self.resource_id] = self

    @property
    def resource_type(self) -> str:
        return self.__class__.__name__


RESOURCES: dict[str, Resource] = {}
