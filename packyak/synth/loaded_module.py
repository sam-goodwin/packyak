import ast
import types


class LoadedModule:
    def __init__(
        self,
        module: types.ModuleType,
        ast: ast.Module,
        module_name: str,
        file_name: str,
    ):
        self.module = module
        self.ast = ast
        self.module_name = module_name
        self.file_name = file_name
        self.vars = vars(module)
