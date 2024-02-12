from _ast import AsyncFunctionDef, FunctionDef
import ast
from functools import partial
import inspect
from textwrap import dedent
from typing import Any, Callable, cast

from packyak.binding import Binding
from packyak.function import LambdaFunction

from packyak.integration import Integration, is_integration
from packyak.resource import Resource
from packyak.synth.call import Call
from packyak.synth.loaded_module import LoadedModule

Func = Callable[..., Any]


def bind(func: LambdaFunction[Any, Any] | LoadedModule) -> list[Binding]:
    calls = (
        analyze_loaded_module(func)
        if isinstance(func, LoadedModule)
        else analyze_function(func)
    )

    return [
        Binding(func, call.obj, call.func.scopes, call.metadata)
        for call in calls
        if call.obj is not None
    ]


def analyze_loaded_module(module: LoadedModule) -> list[Call]:
    calls: list[Call] = []

    attr_dict = module.vars
    seen = set[Any]()

    def should_skip(node: ast.AST) -> bool:
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            if node.name in attr_dict:
                func = attr_dict[node.name]
                if isinstance(func, LambdaFunction):
                    # Hack: terminate analysis if we come across a LambdaFunction
                    return True
        return False

    def eval_expr(node: ast.AST | None) -> Any:
        if isinstance(node, ast.Name):
            return eval(node.id, attr_dict)
        elif isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.Attribute):
            obj = eval_expr(node.value)
            return getattr(obj, node.attr)
        else:
            raise Exception(f"Unsupported node type: {type(node)}")

    class Visitor(ast.NodeVisitor):
        def visit_FunctionDef(self, node: FunctionDef) -> Any:
            if should_skip(node):
                return node
            return super().generic_visit(node)

        def visit_AsyncFunctionDef(self, node: AsyncFunctionDef) -> Any:
            if should_skip(node):
                return node
            return super().generic_visit(node)

        def visit_Call(self, node: ast.Call):
            try:
                func = eval_expr(node.func)
                if isinstance(func, type) and issubclass(func, Resource):
                    return node
                else:
                    obj = (
                        eval_expr(node.func.value)
                        if isinstance(node.func, ast.Attribute)
                        else func
                    )
                    calls.extend(analyze_function(func, seen, obj=obj))
            except Exception:
                return super().generic_visit(node)

    visitor = Visitor()
    visitor.visit(module.ast)
    return calls


def analyze_function(
    func: Func, seen: set[Func] = set(), *, obj: object | None = None
) -> list[Call]:
    if func in seen:
        return []

    seen.add(func)

    if is_integration(func) and obj is not None:
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
        return analyze_function(func.func, seen, obj=obj)

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
                    self.calls.extend(analyze_function(lookup(node.func.id), seen))
                elif isinstance(node.func, ast.Attribute) and isinstance(
                    node.func.value, ast.Name
                ):
                    calls = analyze_function(
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
