import os
from ..function import LambdaFunction
from ..bucket import Bucket
from ..binding import Binding
from ..resource import Resource
from ..reflect import find_all_bindings
from weakref import WeakKeyDictionary
from constructs import Construct
from aws_cdk import Stack, Resource as AWSResource, aws_iam, aws_lambda, aws_s3
from aws_cdk.aws_lambda_python_alpha import PythonFunction


class RefineryStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)
        bindings = find_all_bindings()

        buckets = Construct(self, "Buckets")
        lambda_functions = Construct(self, "Functions")
        aws_resources = WeakKeyDictionary[Resource, AWSResource]()

        def create_resource(resource: Resource):
            if resource not in aws_resources:
                if isinstance(resource, Bucket):
                    aws_resource = aws_s3.Bucket(buckets, resource.id)
                elif isinstance(resource, LambdaFunction):
                    role = aws_iam.Role(
                        scope=lambda_functions,
                        id=f"{resource.id}-role",
                        assumed_by=aws_iam.ServicePrincipal("lambda.amazonaws.com"),
                    )
                    aws_resource = PythonFunction(
                        scope=lambda_functions,
                        id=resource.id,
                        role=role,
                        entry=os.path.dirname(resource.file_name),
                        index=os.path.basename(resource.file_name),
                        runtime=aws_lambda.Runtime.PYTHON_3_12,
                    )
                else:
                    raise Exception(
                        f"Unknown resource type {type(resource)} {resource}"
                    )
                aws_resources[resource] = aws_resource
            return aws_resources[resource]

        def bind(binding: Binding):
            from_resource = create_resource(binding.from_resource)
            to_resource = create_resource(binding.to_resource)

            if not isinstance(to_resource, aws_lambda.Function):
                raise Exception("Binding target is not a Lambda function")

            resource_id = binding.from_resource.id

            def add_env(**kwargs):
                for key, value in kwargs.items():
                    to_resource.add_environment(f"{resource_id}_{key}", value)

            if isinstance(from_resource, aws_s3.Bucket):
                add_env(
                    bucket_name=from_resource.bucket_name,
                    bucket_arn=from_resource.bucket_arn,
                )
                if "read" in binding.scopes:
                    from_resource.grant_read(to_resource)
                if "write" in binding.scopes:
                    from_resource.grant_write(to_resource)

        for binding in bindings:
            bind(binding)
