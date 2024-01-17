import os
from typing import Any

from packyak.synth.synth import synth


async def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=str, help="root directory", required=True)
    args = parser.parse_args()

    packyak_spec = await synth(root_dir=args.root)
    packyak_dir = ".packyak"

    if not os.path.exists(packyak_dir):
        os.makedirs(packyak_dir)
    with open(f"{packyak_dir}/spec.json", "w") as f:
        spec = packyak_spec.model_dump(
            exclude_unset=True,
            exclude_none=True,
        )

        def transform(obj: Any) -> Any:
            if isinstance(obj, dict):
                d = dict(
                    (
                        k,
                        transform(v),
                        # TODO: decide whether the file_name should be relative or absolute
                        # os.path.relpath(v, packyak_dir)
                        # if k == "file_name"
                        # else transform(v),
                    )
                    for k, v in obj.items()
                    if not k.startswith("_")
                )
                return d

            elif isinstance(obj, list):
                return [transform(v) for v in obj]
            return obj

        import json

        f.write(json.dumps(transform(spec), indent=2))


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
