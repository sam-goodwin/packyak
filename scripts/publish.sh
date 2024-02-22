#! /usr/bin/env bash

version=$(node -p "require('./package.json').version")

script_dir=$(dirname -- "${BASH_SOURCE[0]}")
echo "Script directory: $script_dir"

node $script_dir/bump.mjs

echo $version

# poetry build && poetry publish
# cd packyak-aws-cdk
# pnpm run build
# pnpm run package
# pnpm run publish:pypi
# npm publish
