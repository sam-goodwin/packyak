import os
from pyspark.sql import SparkSession


def init_session(cwd: str = os.getcwd(), venv: str | None = None) -> SparkSession:
    return session_builder(cwd, venv).getOrCreate()


def session_builder(
    cwd: str = os.getcwd(), venv: str | None = None
) -> SparkSession.Builder:
    venv = venv if venv is not None else os.path.join(cwd, ".venv", "bin", "python")

    builder: SparkSession.Builder = (
        SparkSession.builder.master("yarn")
        .config("spark.pyspark.python", venv)
        .config("spark.pyspark.driver.python", venv)
        .config("spark.pyspark.virtualenv.enabled", "false")
    )
    return builder
