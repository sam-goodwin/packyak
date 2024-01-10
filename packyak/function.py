from typing import (
    Callable,
    Generic,
    Optional,
    TypeVar,
    Protocol,
    ParamSpec,
    runtime_checkable,
    cast,
)

from packyak.globals import FUNCTIONS

Params = ParamSpec("Params")
Return = TypeVar("Return", covariant=True)


@runtime_checkable
class LambdaFunction(Protocol, Generic[Params, Return]):
    file_name: str
    function_id: str

    def __call__(self, *args: Params.args, **kwargs: Params.kwargs) -> Return:
        ...


def function(*, function_id: Optional[str] = None):
    def decorator(func: Callable[Params, Return]) -> LambdaFunction[Params, Return]:
        # @wraps(func)
        def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> Return:
            return func(*args, **kwargs)

        func_id = function_id or func.__name__
        setattr(wrapper, "file_name", func.__code__.co_filename)
        setattr(wrapper, "function_id", func_id)

        if func_id in FUNCTIONS:
            raise Exception(f"Lambda Function {func_id} already exists")

        lambda_func = cast(LambdaFunction[Params, Return], wrapper)
        FUNCTIONS[func_id] = lambda_func
        return lambda_func

    return decorator
