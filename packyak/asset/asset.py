from abc import ABC
import dask
import dask.array as da
from dask.base import DaskMethodsMixin
import dask.dataframe as dd
import pyspark as sp
import pyspark.pandas as ps
import pandas as pd
import numpy as np
import numpy.typing as npt


from datetime import datetime
from dataclasses import dataclass
from typing import (
    Any,
    Callable,
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


Frame = da.Array | dd.DataFrame | ps.DataFrame[Any]


class Format(ABC):
    # save a frame to the store
    def save_dask_array(self, location: str, frame: da.Array) -> da.Array:
        ...


class ZarrFormat(Format):
    kwargs: dict[str, Any] = {}

    def __init__(
        self,
        partition: "Any | None" = None,
        component: Optional[str] = None,
        storage_options: Optional[dict[str, Any]] = None,
        overwrite: bool = False,
        region: Optional[str] = None,
        chunks: tuple[int, ...] | None = None,
        return_stored: bool = False,
        **kwargs: dict[str, Any],
    ):
        self.kwargs = {
            "component": component,
            "storage_options": storage_options,
            "overwrite": overwrite,
            "region": region,
            "chunks": chunks,
            "return_stored": return_stored,
            **kwargs,
        }
        self.partition = partition
        self.component = component
        self.storage_options = storage_options
        self.overwrite = overwrite
        self.region = region
        self.chunks = chunks
        self.return_stored = return_stored

    def save_dask_array(self, location: str, frame: da.Array) -> da.Array:
        return frame.to_zarr(location, **self.kwargs)


def zarr(
    location: Location,
    partition: "Any | None" = None,
    component: Optional[str] = None,
    storage_options: Optional[dict[str, Any]] = None,
    overwrite: bool = False,
    region: Optional[str] = None,
    chunks: tuple[int, ...] | None = None,
    return_stored: bool = False,
    **kwargs: dict[str, Any],
):
    return artifact(
        partition=partition,
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


A = TypeVar("A", bound=Artifact)


def artifact(
    format: Format | None = None,
    location: Location = None,
    partition: "Any | None" = None,
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
    location: Location,
    *,
    partition: "Any | None" = None,
    format: Literal["parquet"] | Literal["orc"] | Literal["json"] = "parquet",
    source: bool | None = None,
    deps: list[Artifact | Table[TableSchema]] | None = None,
):
    def decorate(func: Callable[..., DaskValue | ps.DataFrame[TableSchema]]):
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


class Manifest(NamedTuple):
    pass


# Example:

scan_bucket = Bucket("scan_bucket")

pheno_scans = scan_bucket / "pheno_scans"

procode_scans = scan_bucket / "procode_scans"


class Scan(Manifest):
    # define partition keys on the Model explicitly
    scan_id = PartitionKey(str)
    # e.g. second PK
    # scan_date = PartitionKey(str)
    s3_dir: str
    is_complete: bool


# bootstrap the Scan graph by defining a function that returns the initial table
@table(location=(scan_bucket / "scans"), partition=Scan, source=True)
async def scan_images(
    # a reference to "this" table, i.e the current version of the table (at the time we branched)
    self: ps.DataFrame[Scan] | None,
) -> ps.DataFrame[Scan]:
    # scan the s3 directory, compare with previous_scans, return the updated table
    return ps.DataFrame()


@artifact(
    partition=Scan,
    # explicit hard-coded string (escape hatch from Bucket / Folder abstraction)
    location="s3://bucket/phenotype/zarrs/",
    # explicit format is required when using low level @artifact API
    format=ZarrFormat(chunks=(1, 1, 1, -1, -1)),
    # explicit dependencies
    deps=[scan_images],
)
def pheno_image_zarr(scan: Scan) -> npt.ArrayLike:
    return run_artemis(scan)


# @zarr is a wrapper around @artifact optimized for defining artifacts with the ZarrFormat
# this is equivalent to the above ^ but captures the intent better
@zarr(
    location=(scan_bucket / "scans" / Scan.scan_id / "procode"),
    partition=Scan,
    # is this necessary? I can return a pre-chunked array
    chunks=(1, 1, 1, -1, -1),
)
def procode_image_zarr(scan_images: dd.DataFrame) -> da.Array:
    pheno_scans = scan_images.where(scan_images.s3_dir == "procode")
    return pheno_scans.map_blocks(run_artemis)


@artifact(
    location=(scan_bucket / "aligned_lobes"),
    partition=Scan,
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
