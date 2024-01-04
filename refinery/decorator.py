import ast
import inspect
from typing import Any, Callable, Optional, TypeVar, Protocol, ParamSpec
from functools import wraps

# Define a generic return type for the decorator
F = TypeVar('F', bound=Callable)
R = TypeVar('R')

# Define a ParamSpec variable to capture the original function's signature
P = ParamSpec('P')


class InflightFunction(Protocol[P, R]):
    inflight: True
    scope: list[str]

def inflight(*scope: str):
    def function(func: Callable[P, R]) -> InflightFunction[P, R]:
        func.inflight = True
        func.scope = scope
        return func
    return function

class LambdaFunction(Protocol[P, R]):
    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        ...

    get_free_vars: Callable[[], dict[str, Any]]
    approval: Optional[str]

def function(*, requires_approval: bool = False):
    def function(func: Callable[P, R]) -> LambdaFunction[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            return func(*args, **kwargs)
        
        wrapper.get_free_vars = lambda: get_free_vars(func)  # type: ignore
        wrapper.requires_approval = requires_approval
        return wrapper  # type: ignore
    return function

def dedent(src):
    lines = src.split('\n')
    # Filter out blank lines and find the minimum indentation
    min_indent = min(len(line) - len(line.lstrip()) for line in lines if line.strip())
    # Remove the minimum indentation from all lines
    dedented_lines = [line[min_indent:] if line.strip() else line for line in lines]
    return '\n'.join(dedented_lines)

def get_free_vars(func):
    # Get the source of the function
    src = dedent(inspect.getsource(func))

    # Parse the source into an AST
    func_ast = ast.parse(src)

    # Process the AST to find dependencies
    dependencies = find_names(func_ast)

    lexical_scope = get_lexical_scope(func)

    def lookup(name):
        try:
            return eval(name, lexical_scope)
        except NameError:
            return None

    # Map dependencies to actual values (globals and closure vars)
    return {dep: value for dep, value in ((dep, lookup(dep)) for dep in dependencies) if value is not None}

# Function to process the AST and find dependencies
def find_names(tree):
    # Custom visitor class to find free variables
    class DepVisitor(ast.NodeVisitor):
        def __init__(self):
            self.deps = []

        def visit_Name(self, node):
            if isinstance(node.ctx, ast.Load):
                self.deps.append(node.id)

    visitor = DepVisitor()
    visitor.visit(tree)
    return visitor.deps


# Get the lexical scope of a function
def get_lexical_scope(func):
    globals = func.__globals__
    closure_vars = {}
    if func.__closure__ is not None:
        closure_var_names = func.__code__.co_freevars
        closure_vars = {name: cell.cell_contents for name, cell in zip(
            closure_var_names, func.__closure__
        )}

    lexical_scope = {**globals, **closure_vars}

    return lexical_scope
