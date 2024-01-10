from typing import (
    Any,
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
    metadata: dict[str, Any] | None

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        ...


def integration(*scopes: str, **kwargs: property):
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        setattr(func, "scopes", scopes)
        setattr(func, "metadata", kwargs if kwargs and len(kwargs) > 0 else None)
        return func

    return decorator
