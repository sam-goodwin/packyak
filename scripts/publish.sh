#! /usr/bin/env bash

set -e

extra_args=$*
version=$(node -p "require('./package.json').version")

pnpm run clean
pnpm run build

script_dir=$(dirname -- "${BASH_SOURCE[0]}")
echo "Script directory: $script_dir"

node $script_dir/bump.mjs ${extra_args}

poetry build && poetry publish
cd packyak-aws-cdk
pnpm run build
pnpm run package
pnpm run publish:pypi
npm publish
