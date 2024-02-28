import os
from typing import cast


def init_session(cwd: str = os.getcwd(), venv: str | None = None):
    return session_builder(cwd, venv).getOrCreate()


is_spark_found = False


def session_builder(cwd: str = os.getcwd(), venv: str | None = None):
    global is_spark_found
    if not is_spark_found:
        is_spark_found = True
        import findspark

        findspark.init()

    from pyspark.sql import SparkSession

    venv = venv if venv is not None else os.path.join(cwd, ".venv", "bin", "python")

    return cast(
        SparkSession.Builder,
        (
            SparkSession.builder.master("yarn")
            .config("spark.pyspark.python", venv)
            .config("spark.pyspark.driver.python", venv)
            .config("spark.pyspark.virtualenv.enabled", "false")
        ),
    )
