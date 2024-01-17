def file_path_to_parent_package(file_path: str) -> str:
    components = file_path.split("/")
    package_name = ".".join(components[:-1])
    return package_name


def file_path_to_module_name(file_path: str) -> str:
    file_path = file_path.rsplit(".", 1)[0]
    components = file_path.split("/")
    package_name = ".".join(components)
    return package_name
