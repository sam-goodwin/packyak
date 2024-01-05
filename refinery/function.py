from typing import (
    Any,
    Callable,
    Optional,
    TypeVar,
    Protocol,
    ParamSpec,
    runtime_checkable,
)

Params = ParamSpec("Params")
Return = TypeVar("Return")


def is_lambda_function(obj: Any) -> bool:
    return isinstance(obj, LambdaFunction) and getattr(obj, "type", None) == "Lambda"


@runtime_checkable
class LambdaFunction(Protocol[Params, Return]):
    file_name: str


def function(*, name: Optional[str] = None):
    def function(func: Callable[Params, Return]) -> LambdaFunction[Params, Return]:
        func.file_name = func.__code__.co_filename
        func.id = name or func.__name__
        functions[func.id] = func
        return func

    return function


functions: dict[str, LambdaFunction] = {}
