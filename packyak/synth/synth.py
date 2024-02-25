import ast
from importlib import import_module
import os
import types
from typing import Any

import aiofiles

from packyak.storage.bucket import Bucket
from packyak.runnable.cluster import Cluster
from packyak.runnable.function import LambdaFunction
from packyak.runnable.job import Job
from packyak.messaging.queue import Queue
from packyak.registry import find_all_functions, find_all_resources
from packyak.resource import Resource
from packyak.runnable.runnable import Runnable
from packyak.spec import (
    BucketSpec,
    BucketSubscriptionSpec,
    ClusterSpec,
    FunctionSpec,
    JobSpec,
    ModuleSpec,
    PackyakSpec,
    QueueSpec,
    QueueSubscriptionSpec,
)
from packyak.synth.analyze import bind
from packyak.synth.file_utils import file_path_to_module_name
from packyak.synth.loaded_module import LoadedModule


async def synth(root_dir: str) -> PackyakSpec:
    def visit(resource: Resource):
        if resource in seen:
            return
        seen.add(resource)

        def get_bindings(resource: Runnable[Any, Any]):
            bindings = bind(resource)
            return (
                [binding.to_binding_spec() for binding in bind(resource)]
                if len(bindings) > 0
                else None
            )

        if isinstance(resource, Bucket):
            buckets.append(
                BucketSpec(
                    bucket_id=resource.resource_id,
                    subscriptions=[
                        BucketSubscriptionSpec(
                            scopes=sub.scopes,
                            function_id=sub.function.resource_id,
                        )
                        for sub in resource.subscriptions
                    ],
                )
            )
        elif isinstance(resource, Queue):
            queues.append(
                QueueSpec(
                    queue_id=resource.resource_id,
                    fifo=resource.fifo,
                    subscriptions=[
                        QueueSubscriptionSpec(function_id=sub.function.resource_id)
                        for sub in resource.subscriptions
                    ],
                )
            )
        elif isinstance(resource, LambdaFunction):
            functions.append(
                FunctionSpec(
                    function_id=resource.resource_id,
                    file_name=resource.file_name,
                    bindings=get_bindings(resource),
                    with_=resource.with_,
                    without=resource.without,
                    dev=resource.dev,
                    all_extras=resource.all_extras,
                    without_hashes=resource.without_hashes,
                    without_urls=resource.without_urls,
                )
            )
        elif isinstance(resource, Job):
            jobs.append(
                JobSpec(
                    job_id=resource.resource_id,
                    file_name=resource.file_name,
                    bindings=get_bindings(resource),
                    with_=resource.with_,
                    without=resource.without,
                    dev=resource.dev,
                    all_extras=resource.all_extras,
                    without_hashes=resource.without_hashes,
                    without_urls=resource.without_urls,
                )
            )
        elif isinstance(resource, Cluster):
            clusters.append(ClusterSpec(cluster_id=resource.cluster_id))

    modules: list[ModuleSpec] = []
    functions: list[FunctionSpec] = []
    buckets: list[BucketSpec] = []
    queues: list[QueueSpec] = []
    clusters: list[ClusterSpec] = []
    jobs: list[JobSpec] = []
    seen = set[Any]()

    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".py"):
                print(root_dir, file)
                file_path = os.path.join(root, file)
                absolute_file_path = os.path.abspath(file_path)
                async with aiofiles.open(file_path, mode="r") as f:
                    module_ast = ast.parse(await f.read())
                module_name = file_path_to_module_name(file_path)
                module: types.ModuleType = import_module(module_name)

                loaded_module = LoadedModule(module, module_ast, module_name, file_path)

                bindings = bind(loaded_module)
                if len(bindings) > 0:
                    modules.append(
                        ModuleSpec(
                            file_name=absolute_file_path,
                            bindings=[
                                binding.to_binding_spec() for binding in bindings
                            ],
                        )
                    )

    for resource in find_all_resources():
        visit(resource)

    for function in find_all_functions():
        visit(function)

    packyak_spec = PackyakSpec(
        modules=modules,
        buckets=buckets,
        queues=queues,
        functions=functions,
        clusters=clusters,
        jobs=jobs,
    )
    return packyak_spec
