# PackYak ![image](https://github.com/sam-goodwin/packyak/assets/38672686/249af136-45fb-4d13-82bb-5818e803eeb0)

[![PyPI version](https://badge.fury.io/py/packyak.svg)](https://badge.fury.io/py/packyak)

> [!NOTE]
> Still in active development.

# PackYak

PackYak is an open source platform for self-hosting Data Engineering frameworks in your own AWS account:
* [Ray](https://www.ray.io/) - run heterogeneous clusters consisting of CPU, GPU and Memory optimized EC2 instances.
* [Dask](https://www.dask.org/), [Daft](https://www.getdaft.io/), [Spark](https://spark.apache.org/), etc. - run any compute framework supported by Ray
* [Dagster](https://dagster.io/) - orchestrate the production of inter-connected "Software-defined Assets"
* [Nessie](https://projectnessie.org/) & [Iceberg](https://iceberg.apache.org/) - version your data catalog with Git-like branching, tags and commits.
* [Streamlit](https://streamlit.io/) - build interactive reports over your data with simple Python scripts

# Why PackYak

PackYak is built to be deployed to your own AWS Account with Infrastructure-as-Code (IaC) tools such as AWS CDK, Pulumi or Terraform. Instead of integrating each proprietary, managed platform (such as AnyScale, Dagster, DataBricks, DremIO, etc.), PackYak provides Constructs that configure and deploy each of the self-hosted versions of these services to your own AWS account.

Why this is better:
1. No premium over and above the base AWS costs. There's no middleman between the software and the hardware (unless you count the cloud provider).
2. None of the proprietary platforms solve all of your problems and it is inevitable that you'll need to venture outside of their walled gardens. When this happens, you are met with high integration costs trying to make two managed platforms cooperate.
3. Working at the AWS and IaC level keeps the door open to integrating other useful IaC products, e.g. [SST](https://sst.dev/) for frontend and event-driven serverless applications.

PackYak aligns with the philosophy of treating the cloud (e.g. AWS) as your operating system that you install applications in to. 

# Get Started

> [!Note]
> Coming Soon.