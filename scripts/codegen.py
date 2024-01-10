from typing import Union, get_origin, get_args, get_type_hints, Any
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
            items = " | ".join(
                f'"{value}"' if isinstance(value, str) else to_type_expr(value)
                for value in get_union_values(type_)
            )
            if hasattr(type_, "__name__"):
                types.append(f"type {type_.__name__} = {items};")
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


def to_type_expr(class_type: type) -> str:
    if is_list_type(class_type):
        return f"{to_type_expr(get_list_item_type(class_type))}[]"
    # elif is_dict_type(class_type):
    #     return f"Record<string, any>"
    elif isinstance(class_type, type):
        if issubclass(class_type, BaseModel):
            return visit_type(class_type)
        elif issubclass(class_type, dict):
            return f"Record<string, {visit_type(get_list_item_type(class_type))}>"
        elif issubclass(class_type, str):
            return "string"
        elif issubclass(class_type, int) or issubclass(class_type, float):
            return "number"
        elif issubclass(class_type, bool):
            return "boolean"
    elif is_union(class_type):
        return visit_type(class_type)
    raise Exception(f"Unsupported type: {class_type}")


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
        if hasattr(arg, "__args__"):
            args.extend(arg.__args__)
    return args


def get_list_item_type(class_type: Any):
    # For Python 3.8 and newer
    if hasattr(typing, "get_args"):
        return get_args(class_type)[0]
    # For Python 3.7
    elif hasattr(class_type, "__args__"):
        return class_type.__args__[0]
    # Direct comparison (less reliable)
    return class_type[0]


def is_list_type(class_type: Any):
    return get_origin(class_type) is list


def is_dict_type(value: type):
    return get_origin(value) is dict


if __name__ == "__main__":
    visit_type(PackyakSpec)
    types.reverse()
    print("\n".join(types))
    import os

    outfile = os.path.join(
        os.path.dirname(__file__), "..", "packyak", "generated", "spec.ts"
    )

    os.makedirs(os.path.dirname(outfile), exist_ok=True)

    with open(outfile, "w") as f:
        f.write("\n".join(types))
