from typing import Any, Callable


def get_fully_qualified_name(function: Callable[..., Any] | type):
    module_name = function.__module__
    qual_name = function.__qualname__
    return f"{module_name}.{qual_name}"
