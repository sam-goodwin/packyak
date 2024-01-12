from typing import Literal, Union, get_origin, get_args, get_type_hints, Any
import typing

import inspect

from pydantic import BaseModel
from packyak.spec import PackyakSpec
# from pydantic import BaseModel

generated_classes = set[Any]()

types: list[str] = []


def visit_type(type_: type) -> str:
    global generated_classes

    if type_ not in generated_classes:
        if is_union(type_):
            items = " | ".join(v for v in get_union_values(type_))
            if hasattr(type_, "__name__"):
                types.append(f"export type {type_.__name__} = {items};")
            else:
                return items
        elif issubclass(type_, BaseModel):
            generated_classes.add(type_)
            props: list[str] = []
            for name, prop_type in get_type_hints(type_).items():
                if (
                    isinstance(prop_type, type)
                    and issubclass(prop_type, BaseModel)
                    and prop_type not in generated_classes
                ):
                    props.append(visit_type(prop_type))
                    generated_classes.add(prop_type)
                else:
                    props.append(f"  {name}: {to_type_expr(prop_type)};")

            types.append(
                f"export type {type_.__name__} = {{\n" + "\n".join(props) + "\n}"
            )
    return type_.__name__


def to_type_expr(type_: type | str) -> str:
    if isinstance(type_, str):
        return f'"{type_}"'
    elif is_list_type(type_):
        return f"{to_type_expr(get_list_item_type(type_))}[]"
    elif is_dict_type(type_):
        (key_type, value_type) = get_args(type_)
        return f"Record<{to_type_expr(key_type)}, {to_type_expr(value_type)}>"
    elif isinstance(type_, type):
        if issubclass(type_, type(None)):
            return "undefined"
        elif issubclass(type_, BaseModel):
            return visit_type(type_)
        elif issubclass(type_, dict):
            return f"Record<string, {visit_type(get_list_item_type(type_))}>"
        elif issubclass(type_, str):
            return "string"
        elif issubclass(type_, int) or issubclass(type_, float):
            return "number"
        elif issubclass(type_, bool):
            return "boolean"
    elif is_literal(type_):
        options = get_args(type_)
        if len(options) == 1:
            return to_type_expr(options[0])
        else:
            return " | ".join(to_type_expr(option) for option in options)
    elif is_union(type_):
        return visit_type(type_)
    raise Exception(f"Unsupported type: {type_}")


def is_literal(type_: type):
    return get_origin(type_) is Literal


def is_union(type_: type):
    return (
        not inspect.isclass(type_)
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
    visit_type(PackyakSpec)
    types.reverse()
    # print("\n".join(types))
    import os

    outfile = os.path.join(
        os.path.dirname(__file__), "..", "packyak", "generated", "spec.ts"
    )

    os.makedirs(os.path.dirname(outfile), exist_ok=True)

    with open(outfile, "w") as f:
        f.write("\n".join(types))
