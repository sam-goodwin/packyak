import types
from typing import (
    Literal,
    Union,
    get_origin,
    get_args,
    get_type_hints,
    Any,
)
import typing

import inspect

from pydantic import BaseModel
from packyak.spec import PackyakSpec

visited_types = set[Any]()

exported_types: list[str] = []


def to_type(type_: type) -> str:
    global visited_types

    if not hasattr(type_, "__name__"):
        return to_type_expr(type_)

    if isinstance(type_, type):
        if issubclass(type_, BaseModel):
            declare_interface(type_)
            return type_.__name__
    # elif isinstance(type_, TypeAliasType):
    #     declare_type_alias(type_)
    #     return type_.__name__
    elif is_union(type_):
        declare_union(type_)
        return type_.__name__
    return to_type_expr(type_)


def declare_type_alias(type_: Any):
    if type_ in visited_types:
        return
    visited_types.add(type_)
    exported_types.append(
        f"export type {type_.__name__} = {to_type_expr(type_.__value__)};"
    )


def declare_union(type_: Any):
    if type_ in visited_types:
        return
    visited_types.add(type_)
    exported_types.append(f"export type {type_.__name__} = {to_type_expr(type_)};")


def declare_interface(type_: type):
    if type_ in visited_types:
        return
    visited_types.add(type_)
    props: list[str] = []
    for name, prop_type in get_type_hints(type_).items():
        if (
            isinstance(prop_type, type)
            and inspect.isclass(prop_type)
            and issubclass(prop_type, BaseModel)
            and prop_type not in visited_types
        ):
            props.append(to_type(prop_type))
            visited_types.add(prop_type)
        else:
            props.append(f"  {rename(name)}: {to_type_expr(prop_type)};")

    sub_types = inspect.getmro(type_)
    extends = [
        to_type(sub_type)
        for sub_type in sub_types
        if type_ != sub_type
        and issubclass(sub_type, BaseModel)
        and sub_type.__name__ != "BaseModel"
    ]

    sub_classes = ", ".join(extends)
    exported_types.append(
        f"export interface {type_.__name__}{f' extends {sub_classes}' if len(extends) > 0 else ''} {{\n"
        + "\n".join(props)
        + "\n}"
    )


def rename(name: str) -> str:
    if name == "with_":
        return "with"
    return name


def to_type_expr(type_: type | str) -> str:
    if is_union(type_):
        return " | ".join(v for v in get_union_values(type_))
    if is_non_empty_list(type_):
        item = to_type(get_args(type_)[0])
        return f"[{item}, ...{item}[]]"
    elif isinstance(type_, str):
        return f'"{type_}"'
    elif is_list_type(type_):
        return f"{to_type(get_list_item_type(type_))}[]"
    elif is_dict_type(type_):
        (key_type, value_type) = get_args(type_)
        return f"Record<{to_type(key_type)}, {to_type(value_type)}>"
    elif isinstance(type_, type):
        if type_ is type(None):
            return "undefined"
        elif issubclass(type_, BaseModel):
            return to_type(type_)
        elif issubclass(type_, str):
            return "string"
        elif issubclass(type_, bool):
            return "boolean"
        elif issubclass(type_, int) or issubclass(type_, float):
            return "number"
    # elif isinstance(type_, TypeAliasType):
    #     return to_type(type_)
    elif is_literal(type_):
        options = get_args(type_)
        if len(options) == 1:
            return to_type(options[0])
        else:
            return " | ".join(to_type(option) for option in options)
    raise Exception(f"Unsupported type: {type_}")


def is_type_alias(type_: Any) -> bool:
    return (
        hasattr(type_, "__name__")
        and hasattr(type_, "__origin__")
        and hasattr(type_, "__value__")
    )


def is_non_empty_list(type_: Any) -> bool:
    return (
        is_type_alias(type_)
        and hasattr(type_, "__name__")
        and type_.__name__ == "NonEmptyList"
    )


def is_literal(type_: type):
    return get_origin(type_) is Literal


def is_union(type_: Any):
    return (
        (isinstance(type_, type) or isinstance(type_, types.UnionType))
        and not inspect.isclass(type_)
        and hasattr(type_, "__or__")
        or get_origin(type_) is Union
    )


def get_union_values(type_: Any) -> list[Any]:
    args: list[Any] = []
    if hasattr(type_, "__value__") and is_union(type_.__value__):
        return get_union_values(type_.__value__)

    for arg in get_args(type_):
        args.append(to_type_expr(arg))
    return args


def get_list_item_type(type_: Any):
    # For Python 3.8 and newer
    if hasattr(typing, "get_args"):
        return get_args(type_)[0]
    # For Python 3.7
    elif hasattr(type_, "__args__"):
        return type_.__args__[0]
    # Direct comparison (less reliable)
    return type_[0]


def is_list_type(type_: Any):
    return get_origin(type_) is list


def is_dict_type(type_: type):
    return get_origin(type_) is dict


if __name__ == "__main__":
    to_type(PackyakSpec)
    exported_types.reverse()
    # print("\n".join(types))
    import os

    outfile = os.path.join(
        os.path.dirname(__file__), "..", "packyak", "generated", "spec.ts"
    )

    os.makedirs(os.path.dirname(outfile), exist_ok=True)

    with open(outfile, "w") as f:
        f.write("\n".join(exported_types))
