from abc import ABC
import dask
import dask.array as da
from dask.base import DaskMethodsMixin
import dask.dataframe as dd
import pyspark as sp
import pyspark.sql as sql
import pyspark.pandas as ps
import pandas as pd
import numpy as np
import numpy.typing as npt


from datetime import datetime
from dataclasses import dataclass
from typing import (
    Any,
    Callable,
    Coroutine,
    Generic,
    Literal,
    NamedTuple,
    ParamSpec,
    TypeVar,
    Union,
    Tuple,
    overload,
    Optional,
)

from packyak.storage.bucket import Bucket
from packyak.storage.folder import Folder

Location = str | Folder | Bucket | None


Frame = da.Array | dd.DataFrame | ps.DataFrame[Any] | sql.DataFrame


class Format(ABC):
    # save a frame to the store
    def save_dask_array(self, location: str, frame: da.Array) -> da.Array:
        ...


class ZarrFormat(Format):
    def __init__(
        self,
        subject: "Any | None" = None,
        component: Optional[str] = None,
        storage_options: Optional[dict[str, Any]] = None,
        overwrite: bool = False,
        region: Optional[str] = None,
        chunks: tuple[int, ...] | None = None,
        return_stored: bool = False,
        **kwargs: dict[str, Any],
    ):
        self.kwargs = kwargs
        self.subject = subject
        self.component = component
        self.storage_options = storage_options
        self.overwrite = overwrite
        self.region = region
        self.chunks = chunks
        self.return_stored = return_stored

    def save_dask_array(self, location: str, frame: da.Array) -> da.Array:
        return frame.to_zarr(
            location,
            **{
                "component": self.component,
                "storage_options": self.storage_options,
                "overwrite": self.overwrite,
                "region": self.region,
                "chunks": self.chunks,
                "return_stored": self.return_stored,
                **self.kwargs,
            },
        )


def zarr(
    location: Location,
    subject: "Any | None" = None,
    component: Optional[str] = None,
    storage_options: Optional[dict[str, Any]] = None,
    overwrite: bool = False,
    region: Optional[str] = None,
    chunks: tuple[int, ...] | None = None,
    return_stored: bool = False,
    **kwargs: dict[str, Any],
):
    return artifact(
        subject=subject,
        location=location,
        format=ZarrFormat(
            component=component,
            storage_options=storage_options,
            overwrite=overwrite,
            region=region,
            chunks=chunks,
            return_stored=return_stored,
            **kwargs,
        ),
    )


class Artifact:
    def __init__(self, func: Callable[..., da.Array | npt.ArrayLike]):
        self.func = func


def artifact(
    format: Format | None = None,
    location: Location = None,
    subject: "Any | None" = None,
    deps: "list[Artifact | Table[TableSchema]] | None" = None,
):
    def decorate(func: Callable[..., da.Array | npt.ArrayLike]) -> Artifact:
        return Artifact(func)

    return decorate


TableSchema = TypeVar("TableSchema", bound=NamedTuple)


class Table(Generic[TableSchema]):
    def __init__(self, func: Callable[..., ps.DataFrame[TableSchema]]):
        self.func = func


DaskValue = DaskMethodsMixin


def table(
    *,
    location: Location = None,
    subject: "Any | None" = None,
    format: Literal["parquet"] | Literal["orc"] | Literal["json"] = "parquet",
    source: bool | None = None,
    deps: list[Artifact | Table[TableSchema]] | None = None,
):
    def decorate(
        func: Callable[..., DaskValue | ps.DataFrame[TableSchema]],
    ):
        return Table[Any](func)  # type: ignore

    return decorate


class ZarrStore:
    pass


def run_artemis(scan: "Scan") -> da.Array:
    return da.empty()


def align_images(pheno_image: da.Array, procode_image: da.Array) -> da.Array:
    return da.concatenate([pheno_image, procode_image], axis=0)


PartitionKeyValue = str | int | float | bool | datetime


@dataclass
class PartitionKeySpec:
    dtype: type[str | int | float | bool]


PK = TypeVar("PK", bound=PartitionKeyValue)


def PartitionKey(dtype: type[PK]) -> PK:
    return PartitionKeySpec(dtype)  # type: ignore


class Thing(NamedTuple):
    @classmethod
    def has_a(cls, object: type["Thing"]):
        return artifact()

    @classmethod
    def has_an(cls, object: type["Thing"]):
        return artifact()

    @classmethod
    def has_many(cls, object: type["Thing"]):
        return artifact()


# Example:

scan_bucket = Bucket("scan_bucket")

orion_scans = scan_bucket / "orion" / "scans"


class Scan(Thing):
    # define partition keys on the Model explicitly
    scan_id = PartitionKey(str)
    # e.g. second PK
    # scan_date = PartitionKey(str)
    s3_dir: str
    is_complete: bool


# bootstrap the Scan graph by defining a function that returns the initial table
@table(subject=Scan, source=True)
def orion_scan(
    sc: sp.SparkContext,
    spark: sql.SparkSession,
    # a reference to "this" table, i.e the current version of the table (at the time we branched)
    self: ps.DataFrame[Scan] | None,
) -> ps.DataFrame[Scan]:
    # scan the s3 directory, compare with previous_scans, return the updated table

    # option 1 - use raw boto client
    import boto3

    s3 = boto3.client("s3")

    s3.list_objects_v2(...)

    # option 2 - use the PackYak bucket abstraction

    orion_scans.list_sync()

    # option 3 - use Spark Context

    sc.binaryFiles()

    # option 4 - use SparkSession

    spark.read.json()
    spark.read.parquet()
    spark.sql("select ...")

    return ps.DataFrame()


class Image(Scan):
    image_id = PartitionKey(str)


# could model dependencies explicitly
@Scan.has_an(Image)
def orion_image() -> da.Array:
    return da.empty()


class Lobe(Thing):
    scan_id: str
    # partition using lobe_id for anything that depends on a lobe
    lobe_id = PartitionKey(str)


@Scan.has_many(Lobe)
def lobes() -> da.Array:
    return da.empty()


@artifact(
    subject=Scan,
    # explicit hard-coded string (escape hatch from Bucket / Folder abstraction)
    location="s3://bucket/phenotype/zarrs/",
    # explicit format is required when using low level @artifact API
    format=ZarrFormat(chunks=(1, 1, 1, -1, -1)),
    # explicit dependencies
    deps=[orion_scan],
)
def pheno_image_zarr(scan: Scan) -> npt.ArrayLike:
    return run_artemis(scan)


# @zarr is a wrapper around @artifact optimized for defining artifacts with the ZarrFormat
# captures the intent better than @artifact
@zarr(
    subject=Scan,
    location=(scan_bucket / "scans" / Scan.scan_id / "procode"),
    # is this necessary? I can return a pre-chunked array
    chunks=(1, 1, 1, -1, -1),
)
# this is a different take on the above ^ that uses a dask data frame
# to work with the scan_image table instead of an individual Scan record
# it then uses map_blocks to fan out
# it showcases how easy it is to pivot perspective declaratively with types
def procode_image_zarr(
    scan_images: dd.DataFrame,
) -> dd.DataFrame:  # TODO: can return type be anything other than a data frame?
    pheno_scans = scan_images.where(scan_images.scan_type == "procode")
    return pheno_scans.map_blocks(run_artemis)


@artifact(
    location=(scan_bucket / "aligned_lobes" / Scan.scan_id),
    subject=Scan,
    # explicit dependencies are supported
    deps=[pheno_image_zarr, procode_image_zarr],
)
def aligned_lobe(
    pheno_image_zarr: ZarrStore, procode_image_zarr: ZarrStore
) -> da.Array:
    pheno_image = da.from_zarr(pheno_image_zarr, component=3, chunks=(1, 1, 1, -1, -1))
    procode_image = da.from_zarr(
        procode_image_zarr, component=3, chunks=(1, 1, 1, -1, -1)
    )
    return align_images(pheno_image, procode_image)


@table()
def mouse_cells(aligned_lobe: da.Array) -> dd.DataFrame:
    # TODO - create a table with dask
    pass
