from typing import TYPE_CHECKING, Callable
from enum import Enum
from .asset import AssetNode, TInput, TOutput, TableAssetNode

if TYPE_CHECKING:
    import pyspark.sql as sql
    import pyspark.pandas as ps


class TableFormat(Enum):
    AVRO = "avro"
    CSV = "csv"
    DELTA = "delta"
    JSON = "json"
    ORC = "orc"
    PARQUET = "parquet"


class Namespace:
    def __init__(self, name: str, parent: "Namespace | None" = None):
        self.name = name
        self.parent = parent
        self.children: dict[str, Namespace] = {}

    def __getattr__(self, name: str) -> "Namespace":
        if name not in self.children:
            self.children[name] = Namespace(name, self)
        return self.children[name]

    def table(
        self,
        *,
        input: AssetNode[TInput],
        output: type[TOutput] | None = None,
        format: TableFormat = TableFormat.PARQUET,
    ):
        def create_table_node(
            f: Callable[
                [ps.DataFrame[TInput]],
                ps.DataFrame[TOutput] | sql.DataFrame,
            ]
            | Callable[
                [sql.DataFrame],
                ps.DataFrame[TOutput] | sql.DataFrame,
            ],
        ) -> TableAssetNode[TOutput]:
            return TableAssetNode[TOutput](input=input)

        return create_table_node


class DB(Namespace):
    def __init__(self, name: str):
        super().__init__(name)
        if name in dbs:
            raise ValueError(f"DB {name} already exists")
        dbs[name] = self


dbs: dict[str, DB] = {}
