import ast
from functools import partial
import inspect
from typing import Any, Callable, Sequence, cast

from packyak.globals import BUCKETS, FUNCTIONS, QUEUES

from packyak.resource import Resource

from .binding import Binding
from .function import LambdaFunction
from .integration import Integration


def find_all_resources() -> Sequence[Resource]:
    return list(BUCKETS.values()) + list(QUEUES.values())


def find_all_functions() -> list[LambdaFunction[Any, Any]]:
    return list(FUNCTIONS.values())


type Func = Callable[..., Any]


# walks a function to detect its dependencies
def find_bindings(func: LambdaFunction[Any, Any]) -> list[Binding]:
    print("analyze", func.function_id)
    bindings: list[Binding] = []

    for call in find_calls(func):
        if call.obj is None:
            raise Exception("Integration must be called on an object")
        bindings.append(Binding(func, call.obj, call.func.scopes, call.metadata))

    return bindings


class Call:
    def __init__(
        self,
        func: Integration[Any, Any],
        *,
        obj: Any = None,
        metadata: dict[str, property] | None = None,
    ):
        self.func = func
        self.obj = obj
        self.metadata = metadata


def find_calls(
    func: Func, seen: set[Func] = set(), *, obj: object | None = None
) -> list[Call]:
    if func in seen:
        return []

    seen.add(func)

    if hasattr(func, "scopes") and obj is not None:
        # this is an Integration
        integration = cast(Integration[Any, Any], func)
        metadata = {}
        if integration.metadata is not None:
            for k, v in integration.metadata.items():
                if isinstance(v, property):
                    metadata[k] = getattr(obj, v.fget.__name__)
                else:
                    metadata[k] = getattr(obj, v)

        return [
            Call(
                func=func,  # type: ignore
                obj=obj,
                metadata=metadata,
            )
        ]
    elif isinstance(func, partial):
        print("partial")
        return find_calls(func.func, seen, obj=obj)

    lexical_scope = get_lexical_scope(func)

    def lookup(expr: str):
        return eval(expr, lexical_scope)

    # Get the source of the function
    try:
        src = dedent(inspect.getsource(func))
    except TypeError:
        # TODO: Handle builtins
        return []

    # Parse the source into an AST
    module = ast.parse(src)

    # Custom visitor class to find function calls
    class CallVisitor(ast.NodeVisitor):
        calls: list[Call]

        def __init__(self):
            self.calls = []

        def visit_Call(self, node: ast.Call):
            try:
                if isinstance(node.func, ast.Name):
                    self.calls.extend(find_calls(lookup(node.func.id), seen))
                elif isinstance(node.func, ast.Attribute) and isinstance(
                    node.func.value, ast.Name
                ):
                    calls = find_calls(
                        lookup(f"{node.func.value.id}.{node.func.attr}"),
                        seen,
                        obj=lookup(node.func.value.id),
                    )
                    self.calls.extend(calls)

                # elif isinstance(node.func, ast.Subscript):
                #     call = Call(
                #         lookup(f"{node.func.value.id}[{node.func.slice.value.s!r}]"),
                #         lookup(f"{node.func.value.id}"),
                #     )
                #     self.calls.append(call)
            except NameError:
                pass

    visitor = CallVisitor()
    visitor.visit(module)
    return visitor.calls


# Get the lexical scope of a function
def get_lexical_scope(func: Func) -> dict[str, Any]:
    if isinstance(func, partial):
        return get_lexical_scope(func.func)

    globals = func.__globals__ if hasattr(func, "__globals__") else {}
    closure_vars = {}
    if hasattr(func, "__closure__") and func.__closure__ is not None:
        closure_var_names = func.__code__.co_freevars
        closure_vars = {
            name: cell.cell_contents
            for name, cell in zip(closure_var_names, func.__closure__)
        }

    lexical_scope = {**globals, **closure_vars}

    return lexical_scope


def dedent(src: str) -> str:
    lines = src.split("\n")
    # Filter out blank lines and find the minimum indentation
    min_indent = min(len(line) - len(line.lstrip()) for line in lines if line.strip())
    # Remove the minimum indentation from all lines
    dedented_lines = [line[min_indent:] if line.strip() else line for line in lines]
    return "\n".join(dedented_lines)
