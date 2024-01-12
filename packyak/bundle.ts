import type { DataLakeProps } from "./aws-cdk.js";
import type { FunctionSpec } from "./generated/spec.js";

export interface BundleOptions {
  lake: DataLakeProps;
  func: FunctionSpec;
}

export async function bundle(options: BundleOptions) {
  if (options.func.groups === undefined) {
    // default poetry behavior
  } else {
    // poetry export --dev -g ${options.func.groups.join(" ")} -f requirements.txt
  }
  // poetry export to requirements.txt file
  // copy source + requirements.txt into Docker
  // pip install -r requirements.txt
  // generate a packyak index.py that imports the function and calls it - risk of reducing developer control
  // advanced: AST transformer to replace any decorated function with a stub to avoid dependency leak
  // https://gallery.ecr.aws/sam/build-python3.12

  const dependencies = await resolveDependencies(func.dependencies);
  const bindings = await resolveBindings(func.bindings);
  return {
    ...func,
    dependencies,
    bindings,
  };
}
