import os

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pyspark.sql import SparkSession


def init_session(cwd: str = os.getcwd(), venv: str | None = None) -> SparkSession:
    return session_builder(cwd, venv).getOrCreate()


def session_builder(
    cwd: str = os.getcwd(), venv: str | None = None
) -> SparkSession.Builder:
    import findspark

    findspark.init()

    venv = venv if venv is not None else os.path.join(cwd, ".venv", "bin", "python")

    builder: SparkSession.Builder = (
        SparkSession.builder.master("yarn")  # type: ignore - not sure why builder is of type classproperty instead of SparkSession.builder
        .config("spark.pyspark.python", venv)
        .config("spark.pyspark.driver.python", venv)
        .config("spark.pyspark.virtualenv.enabled", "false")
    )
    return builder
