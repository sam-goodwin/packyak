from typing import (
    Callable,
    Generic,
    TypeVar,
    Protocol,
    ParamSpec,
    runtime_checkable,
    cast,
)

from .spec import DependencyGroup
from .globals import FUNCTIONS

Params = ParamSpec("Params")
Return = TypeVar("Return", covariant=True)


"""
From the Python Poetry CLI:

Options:
  -f, --format=FORMAT        Format to export to. Currently, only constraints.txt and requirements.txt are supported. [default: "requirements.txt"]
  -o, --output=OUTPUT        The name of the output file.
      --without-hashes       Exclude hashes from the exported file.
      --without-urls         Exclude source repository urls from the exported file.
      --dev                  Include development dependencies. (Deprecated)
      --without=WITHOUT      The dependency groups to ignore. (multiple values allowed)
      --with=WITH            The optional dependency groups to include. (multiple values allowed)
      --only=ONLY            The only dependency groups to include. (multiple values allowed)
  -E, --extras=EXTRAS        Extra sets of dependencies to include. (multiple values allowed)
      --all-extras           Include all sets of extra dependencies.
      --with-credentials     Include credentials for extra indices.
  -h, --help                 Display help for the given command. When no command is given display help for the list command.
  -q, --quiet                Do not output any message.
  -V, --version              Display this application version.
      --ansi                 Force ANSI output.
      --no-ansi              Disable ANSI output.
  -n, --no-interaction       Do not ask any interactive question.
      --no-plugins           Disables plugins.
      --no-cache             Disables Poetry source caches.
  -C, --directory=DIRECTORY  The working directory for the Poetry command (defaults to the current working directory).
  -v|vv|vvv, --verbose       Increase the verbosity of messages: 1 for normal output, 2 for more verbose output and 3 for debug.
"""


@runtime_checkable
class LambdaFunction(Protocol, Generic[Params, Return]):
    file_name: str
    function_id: str
    with_: DependencyGroup | None
    without: DependencyGroup | None
    dev: bool | None
    all_extras: bool | None
    without_hashes: bool | None
    without_urls: bool | None

    def __call__(self, *args: Params.args, **kwargs: Params.kwargs) -> Return:
        ...


def function(
    function_id: str | None = None,
    *,
    file_name: str | None = None,
    with_: DependencyGroup = None,
    without: DependencyGroup = None,
    # deprecated, use with_ and without
    dev: bool | None = None,
    all_extras: bool | None = None,
    without_hashes: bool | None = None,
    without_urls: bool | None = None,
):
    def decorator(func: Callable[Params, Return]) -> LambdaFunction[Params, Return]:
        # @wraps(func)
        def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> Return:
            return func(*args, **kwargs)

        func_id = function_id or func.__name__
        setattr(wrapper, "file_name", file_name or func.__code__.co_filename)
        setattr(wrapper, "function_id", func_id)
        setattr(wrapper, "with_", with_)
        setattr(wrapper, "without", without)
        setattr(wrapper, "dev", dev)
        setattr(wrapper, "all_extras", all_extras)
        setattr(wrapper, "without_hashes", without_hashes)
        setattr(wrapper, "without_urls", without_urls)

        if func_id in FUNCTIONS:
            raise Exception(f"Lambda Function {func_id} already exists")

        lambda_func = cast(LambdaFunction[Params, Return], wrapper)
        FUNCTIONS[func_id] = lambda_func
        return lambda_func

    return decorator
