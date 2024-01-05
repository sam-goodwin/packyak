import ast
import inspect
from typing import Callable

from .binding import Binding
from .function import LambdaFunction, functions
from .integration import Integration


def find_all_bindings() -> set[Binding]:
    bindings = set[Binding]()
    for func in functions.values():
        found = find_bindings(func)
        bindings.update(found)
    return bindings


# walks a function to detect its dependencies
def find_bindings(func: LambdaFunction) -> set[Binding]:
    bindings = set[Binding]()

    calls = find_calls(func)

    for call in calls:
        if call in bindings:
            continue

        if isinstance(call.func, Integration):
            if call.obj is None:
                raise Exception("Integration must be called on an object")
            bindings.add(Binding(call.obj, func, call.func.scopes))

    return bindings


class Call:
    def __init__(self, func: Callable, *, obj=None):
        self.func = func
        self.obj = obj


def find_calls(func) -> list[Call]:
    lexical_scope = get_lexical_scope(func)

    # Get the source of the function
    src = dedent(inspect.getsource(func))

    # Parse the source into an AST
    module = ast.parse(src)

    def lookup(expr):
        return eval(expr, lexical_scope)

    # Custom visitor class to find function calls
    class CallVisitor(ast.NodeVisitor):
        def __init__(self):
            self.calls = []

        def visit_Call(self, node):
            try:
                if isinstance(node.func, ast.Name):
                    self.calls.append(Call(lookup(node.func.id)))
                elif isinstance(node.func, ast.Attribute):
                    call = Call(
                        func=lookup(f"{node.func.value.id}.{node.func.attr}"),
                        obj=lookup(f"{node.func.value.id}"),
                    )
                    self.calls.append(call)
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
def get_lexical_scope(func):
    globals = func.__globals__
    closure_vars = {}
    if func.__closure__ is not None:
        closure_var_names = func.__code__.co_freevars
        closure_vars = {
            name: cell.cell_contents
            for name, cell in zip(closure_var_names, func.__closure__)
        }

    lexical_scope = {**globals, **closure_vars}

    return lexical_scope


def dedent(src):
    lines = src.split("\n")
    # Filter out blank lines and find the minimum indentation
    min_indent = min(len(line) - len(line.lstrip()) for line in lines if line.strip())
    # Remove the minimum indentation from all lines
    dedented_lines = [line[min_indent:] if line.strip() else line for line in lines]
    return "\n".join(dedented_lines)
