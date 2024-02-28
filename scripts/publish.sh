#! /usr/bin/env bash

set -e

extra_args=$*
version=$(node -p "require('./package.json').version")

pnpm run clean
pnpm run build

script_dir=$(dirname -- "${BASH_SOURCE[0]}")
echo "Script directory: $script_dir"

if [[ " $extra_args " =~ " --no-bump " ]]; then
    echo "Skipping version bump due to --no-bump flag"
else
    env node $script_dir/bump.mjs ${extra_args}
fi

if [ "$BUMP_ROOT" == "true" ]; then
    poetry build && poetry publish
fi

if [ "$BUMP_CDK" == "true" ]; then
    cd packyak-aws-cdk
    pnpm run publish:pypi
    npm publish
fi


