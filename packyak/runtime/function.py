from typing import Callable, TypeVar, ParamSpec
from packyak.runtime.runnable import Runnable
from packyak.util.fqn import get_fully_qualified_name


from packyak.spec import DependencyGroup
from packyak.duration import Duration

Params = ParamSpec("Params")
Return = TypeVar("Return")


class LambdaFunction(Runnable[Params, Return]):
    def __init__(
        self,
        file_name: str,
        handler: Callable[Params, Return],
        function_id: str | None = None,
        memory: int | None = None,
        timeout: Duration | None = None,
        with_: DependencyGroup | None = None,
        without: DependencyGroup | None = None,
        dev: bool | None = None,
        all_extras: bool | None = None,
        without_hashes: bool | None = None,
        without_urls: bool | None = None,
    ) -> None:
        super().__init__(
            resource_id=function_id or get_fully_qualified_name(handler),
            handler=handler,
            file_name=file_name,
            with_=with_,
            without=without,
            dev=dev,
            all_extras=all_extras,
            without_hashes=without_hashes,
            without_urls=without_urls,
        )

        self.memory = memory
        self.timeout = timeout


def function(
    *,
    function_id: str | None = None,
    memory: int | None = None,
    timeout: Duration | None = None,
    file_name: str | None = None,
    with_: DependencyGroup = None,
    without: DependencyGroup = None,
    # deprecated, use with_ and without
    dev: bool | None = None,
    all_extras: bool | None = None,
    without_hashes: bool | None = None,
    without_urls: bool | None = None,
):
    def decorator(handler: Callable[Params, Return]) -> LambdaFunction[Params, Return]:
        _function_id = (
            function_id
            if function_id is not None
            else get_fully_qualified_name(handler)
        )

        func = LambdaFunction(
            function_id=_function_id,
            memory=memory,
            timeout=timeout,
            handler=handler,
            file_name=file_name or handler.__code__.co_filename,
            with_=with_,
            without=without,
            dev=dev,
            all_extras=all_extras,
            without_hashes=without_hashes,
            without_urls=without_urls,
        )

        return func

    return decorator
