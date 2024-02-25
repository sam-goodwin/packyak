from typing import Any, Callable
from aws_cdk import App, RemovalPolicy, Stack
from packyak import Asset
from packyak_aws_cdk import (
    DynamoDBNessieVersionStore,
    Cluster,
    NessieECSCatalog,
    StreamlitSite,
)
from aws_cdk.aws_ec2 import Vpc

# Import the app so that dependencies are implicitly configured
import my_app

removal_policy = RemovalPolicy.DESTROY

app = App()

stack = Stack(app, "stack")

vpc = Vpc(stack, "Vpc")

version_store = DynamoDBNessieVersionStore(stack, "VersionStore")

catalog = NessieECSCatalog(
    stack,
    "Catalog",
    vpc=vpc,
    version_store=version_store,
    catalog_name="my-catalog",
    removal_policy=removal_policy,
    # dns=dict(
    #     domain_name=domain_name,
    #     certificate=self.certificate,
    #     hosted_zone=self.hosted_zone,
    # ),
)

site = StreamlitSite(
    stack,
    "Site",
    home="app/home.py",
    vpc=vpc,
)
