#!/usr/bin/env bash
# Sync the lockstep version of the JS package, the PyO3 wheel, the
# pure-Python mirror and the docs site from the Rust workspace version
# in the root Cargo.toml. Used by the release-pr workflow after
# release-plz bumps Cargo.toml; safe to run by hand too (no-op when
# everything already matches).
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(grep -m1 '^version =' Cargo.toml | sed -E 's/version = "(.*)"/\1/')
echo "syncing lockstep version to $version"

sed -i -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$version\"/" packages/js/package.json
sed -i -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$version\"/" crates/indycheck-py/pyproject.toml packages/python/pyproject.toml
sed -i -E "s/softwareVersion: '[0-9]+\.[0-9]+\.[0-9]+'/softwareVersion: '$version'/" website/astro.config.mjs

echo "packages/js/package.json: $(grep -m1 '"version"' packages/js/package.json)"
echo "crates/indycheck-py/pyproject.toml: $(grep -m1 '^version' crates/indycheck-py/pyproject.toml)"
echo "packages/python/pyproject.toml: $(grep -m1 '^version' packages/python/pyproject.toml)"
echo "website/astro.config.mjs: $(grep -m1 'softwareVersion' website/astro.config.mjs)"
