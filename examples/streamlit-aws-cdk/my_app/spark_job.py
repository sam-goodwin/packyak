from typing import TYPE_CHECKING
from packyak import Bucket, Cluster, every, duration
import json
from datetime import datetime

spark = Cluster("spark")

from pyspark import SparkContext
# from pyspark.sql import SparkSession


data = Bucket("data")

orion = data / "orion"

scans = data / "scans"


@every(1, "day")
@spark.job()
def download_hackernews(sc: SparkContext):
    (
        sc.binaryFiles(f"{scans}/")
        .map(lambda x: x[1].decode("utf-8"))
        .flatMap(lambda x: x.split("\n"))
        .map(lambda x: json.loads(x))
        .toDF()
        .write.parquet(f"{scans}/{datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}/")
    )
