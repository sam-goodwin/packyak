# Dagster
FROM python:3.10-slim as dagster

RUN apt-get update && apt-get upgrade -yqq
RUN apt-get install git -y
ENV DAGSTER_HOME=/opt/dagster/dagster_home/
RUN mkdir -p $DAGSTER_HOME
WORKDIR $DAGSTER_HOME
COPY dagster.yaml workspace.yaml $DAGSTER_HOME

# Install:
# - dagster so we can run `dagster-daemon run`
# - dagster-aws so we can use EcsRunLauncher
# - dagster-postgres so we can use PostgresEventStorage,
#   PostgresRunStorage, and PostgresScheduleStorage
RUN pip install dagster dagster-aws dagster-postgres

# Webserver
FROM dagster as webserver
RUN pip install dagster-webserver dagster-graphql

# User Code gRPC Server
# You can include only one set of definitions
# per code location. Consider adding more code locations
# if you require multiple sets of definition.
FROM dagster as user_code
COPY defs.py $DAGSTER_HOME