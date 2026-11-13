#!/usr/bin/env bash
# Sync the lockstep version of the JS package, the PyO3 wheel, the
# pure-Python mirror, the Flutter package, the Kotlin Gradle project and the
# docs site from the Rust workspace version in the root Cargo.toml. Used by
# the release-pr workflow after release-plz bumps Cargo.toml; safe to run by
# hand too (no-op when everything already matches).
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(grep -m1 '^version =' Cargo.toml | sed -E 's/version = "(.*)"/\1/')
echo "syncing lockstep version to $version"

sed -i -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$version\"/" packages/js/package.json
# The napi-rs package.json is minified single-line JSON (no space after the
# colon), so it needs its own pattern. Its version must match packages/js
# exactly, or napi-release.yml's pre-flight check refuses to publish.
sed -i -E "s/\"version\":\"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\":\"$version\"/" crates/indycheck-napi/package.json
# The root package's optionalDependencies pin the five napi platform
# packages at the exact release version (napi-release.yml pre-flight
# fails otherwise); sync them too.
sed -i -E "/\"indycheck-napi-/s/\"[0-9]+\.[0-9]+\.[0-9]+\"/\"$version\"/" packages/js/package.json
sed -i -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$version\"/" crates/indycheck-py/pyproject.toml packages/python/pyproject.toml
sed -i -E "s/softwareVersion: '[0-9]+\.[0-9]+\.[0-9]+'/softwareVersion: '$version'/" website/astro.config.mjs
sed -i -E "s/^version: [0-9]+\.[0-9]+\.[0-9]+$/version: $version/" packages/flutter/pubspec.yaml
# The Kotlin Android library version lives in packages/kotlin/gradle.properties.
sed -i -E "s/^indycheckVersion=[0-9]+\.[0-9]+\.[0-9]+$/indycheckVersion=$version/" packages/kotlin/gradle.properties
# The Dart and PHP version tests hardcode the expected version (they compare
# it against the C API's core version). Sync them too, or the next bump
# breaks the tests again the same way 0.2.3 did (Flutter 18/19, PHPUnit fail).
sed -i -E "s/expect\(Indycheck\.version\(\), '[0-9]+\.[0-9]+\.[0-9]+'\)/expect(Indycheck.version(), '$version')/" packages/flutter/test/indycheck_test.dart
sed -i -E "s/assertSame\('[0-9]+\.[0-9]+\.[0-9]+', Indycheck::version\(\)\)/assertSame('$version', Indycheck::version())/" packages/php/tests/IndycheckTest.php

echo "packages/js/package.json: $(grep -m1 '"version"' packages/js/package.json)"
echo "crates/indycheck-napi/package.json: $(grep -m1 '"version"' crates/indycheck-napi/package.json)"
echo "packages/js/package.json optionalDependencies: $(grep -m1 'indycheck-napi-linux-x64-gnu' packages/js/package.json)"
echo "crates/indycheck-py/pyproject.toml: $(grep -m1 '^version' crates/indycheck-py/pyproject.toml)"
echo "packages/python/pyproject.toml: $(grep -m1 '^version' packages/python/pyproject.toml)"
echo "website/astro.config.mjs: $(grep -m1 'softwareVersion' website/astro.config.mjs)"
echo "packages/flutter/pubspec.yaml: $(grep -m1 '^version:' packages/flutter/pubspec.yaml)"
echo "packages/kotlin/gradle.properties: $(grep -m1 '^indycheckVersion=' packages/kotlin/gradle.properties)"
echo "packages/flutter/test/indycheck_test.dart: $(grep -m1 'Indycheck.version()' packages/flutter/test/indycheck_test.dart)"
echo "packages/php/tests/IndycheckTest.php: $(grep -m1 'Indycheck::version()' packages/php/tests/IndycheckTest.php)"
