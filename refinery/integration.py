from functools import wraps
from typing import (
    Callable,
    Generic,
    Protocol,
    runtime_checkable,
    TypeVar,
    List,
    ParamSpec,
)

P = ParamSpec("P")
R = TypeVar("R", covariant=True)


@runtime_checkable
class Integration(Protocol, Generic[P, R]):
    scopes: List[str]

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        ...


def integration(*scopes: str):
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs):
            return func(*args, **kwargs)

        setattr(wrapper, "scopes", scopes)
        return wrapper

    return decorator
