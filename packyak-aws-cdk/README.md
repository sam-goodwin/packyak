# PackYak ![image](https://github.com/sam-goodwin/packyak/assets/38672686/249af136-45fb-4d13-82bb-5818e803eeb0)

[![PyPI version](https://badge.fury.io/py/packyak.svg)](https://badge.fury.io/py/packyak)

# Packyak AWS CDK

PackYak is a next-generation framework for building and deploying Data Lakehouses in AWS with a Git-like versioned developer workflow that simplifies how Data Scientists and Data Engineers collaborate.

It enables you to deploy your entire Data Lakehouse, ETL and Machine Learning platforms on AWS with no external dependencies, maintain your Data Tables with Git-like versioning semantics and scale data production with Dagster-like Software-defined Asset Graphs.

It combines 5 key technologies into one framework that makes scaling Data Lakehouses and Data Science teams dead simple:
1. Git-like versioning of Data Tables with [Project Nessie](https://projectnessie.org/) - no more worrying about the version of data, simply use branches, tags and commits to freeze data or roll back mistakes.
2. Software-defined Assets (as seen in Dagster) - think of your data pipelines in terms of the data it produces. Greatly simplify how data is produced, modified over time and backfilled in the event of errors.
3. Infrastructure-as-Code (AWS CDK and Pulumi) - deploy in minutes and manage it all yourself with minimal effort. 
4. Apache Spark - write your ETL as simple python processes that are then scaled automatically over a managed AWS EMR Spark Cluster.
5. Streamlit - build Streamlit applications that integrate the Data Lakehouse and Apache Spark to provide interactive reports and exploratory tools over the versioned data lake.

# Get Started

## Install Docker

If you haven't already, install [Docker](https://docs.docker.com/get-docker/).

## Install Python Poetry & Plugins

```sh
# Install the Python Poetry CLI
curl -sSL https://install.python-poetry.org | python3 -

# Add the export plugin to generate narrow requirements.txt
poetry self add poetry-plugin-export
```

## Install the `packyak` CLI:
```sh
pip install packyak
```

## Create a new Project

```sh
packyak new my-project
cd ./my-project
```

## Deploy to AWS
```sh
poetry run cdk deploy
```

## Git-like Data Catalog (Project Nessie)

PackYak comes with a Construct for hosting a [Project Nessie](https://projectnessie.org/) catalog that supports Git-like versioning of the tables in a Data Lakehouse.

It deploys with an AWS DynamoDB Versioned store and an API hosted in AWS Lambda or AWS ECS. The Nessie Server is stateless and can be scaled easily with minimal-to-zero operational overhead.

### Create a `NessieDynamoDBVersionStore` 

```py
from packyak.aws_cdk import DynamoDBNessieVersionStore

versionStore = DynamoDBNessieVersionStore(
  scope=stack,
  id="VersionStore",
  versionStoreName="my-version-store",
)
```

### Create a Bucket to store Data Tables (e.g. Parquet files). This will store the "Repository"'s data. 

```py
myRepoBucket = Bucket(
  scope=stack,
  id="MyCatalogBucket",
)
```

### Create the Nessie Catalog Service

```py
# hosted on AWS ECS
myCatalog = NessieECSCatalog(
  scope=stack,
  id="MyCatalog",
  vpc=vpc,
  warehouseBucket=myRepoBucket,
  catalogName=lakeHouseName,
  versionStore=versionStore,
)
```

### Create a Branch

Branch off the `main` branch of data into a `dev` branch to "freeze" the data as of a particular commit

```sql
CREATE BRANCH dev FROM main
```

## Deploy a Spark Cluster

Create an EMR Cluster for processing data

```py
spark = Cluster(
  scope=stack,
  id="Spark",
  clusterName="my-cluster",
  vpc=vpc,
  catalogs={
    # use the Nessie Catalog as the default data catalog for Spark SQL queries
    "spark_catalog": myCatalog,
  },
  installSSMAgent=true,
)
```

## Configure SparkSQL to be served over JDBC

```py
sparkSQL = spark.jdbc(port=10001)
```

## Deploy Streamlit Site

Stand up a Streamlit Site to serve interactive reports and applications over your data.

```py
site = StreamlitSite(
  scope=stack,
  # Point it at the Streamlit site entrypoint
  home="app/home.py",
  # Where the Streamlit pages/tabs are, defaults to `dirname(home)/pages/*.py`
  # pages="app/pages"
)
```

## Deploy to AWS

```sh
packyak deploy
```

Or via the AWS CDK CLI:
```sh
poetry run cdk deploy
```
