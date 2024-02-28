import os

def init_session(
    cwd: str = os.getcwd(),
    venv: str = None
):
    return session_builder(cwd, venv).getOrCreate()


def session_builder(
    cwd: str = os.getcwd(),
    venv: str = None
):
    venv = venv if venv is not None else os.path.join(cwd, ".venv", "bin", "python")
    
    from pyspark.sql import SparkSession
    
    return (
        SparkSession.builder.master("yarn")
        .config("spark.pyspark.python", venv)
        .config("spark.pyspark.driver.python", venv)
        .config("spark.pyspark.virtualenv.enabled", "false")
    )
