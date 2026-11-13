# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5](https://github.com/dusmamud/indycheck/compare/indycheck-v0.2.4...indycheck-v0.2.5) - 2026-11-13

### Fixed

- *(pubdev)* install Flutter SDK, not just Dart (example app needs Flutter)

## [0.2.4](https://github.com/dusmamud/indycheck/compare/indycheck-v0.2.3...indycheck-v0.2.4) - 2026-11-13

### Added

- *(ci)* auto-publish Flutter package to pub.dev via OIDC (tag push + dispatch)
- *(ci)* dispatch pub.dev publish from release.yml after the tag is created
- *(flutter)* bundle native library via build hook (Dart side)
- *(flutter)* add Native Assets build hook for prebuilt library
- *(flutter)* add real Flutter example app
- *(kotlin)* add Gradle Android library project for Maven Central
- *(kotlin)* add Gradle wrapper (8.9)
- *(kotlin)* add Android library module (vanniktech Maven Central publish)
- *(kotlin)* add cargo-ndk script for 4 Android ABIs
- *(kotlin)* add Kotlin/Maven Central README and publish docs
- *(kotlin)* add Maven Central publish workflow (vanniktech, Central Portal)
- *(kotlin)* dispatch Maven Central publish from release workflow
- *(kotlin)* sync Gradle version in sync-versions.sh
- *(uniffi)* build staticlib for Apple targets (Swift XCFramework)
- *(swift)* add Swift XCFramework release workflow

### Fixed

- *(flutter)* sync hardcoded version test to 0.2.3
- *(php)* sync hardcoded version test to 0.2.3
- *(go)* link synchronization lib on Windows (WaitOnAddress/WakeByAddress*)
- *(ci)* sync hardcoded version tests in sync-versions.sh so the next bump doesn't break them
- *(c-release)* musl archive is static-only (cargo drops cdylib for the musl target)
- *(c-release)* ios-simulator is arm64-only (rustup cannot add x86_64-apple-ios-sim on ARM64 runner)
- *(flutter)* shorten pubspec description to 149 chars (pub.dev: description too long, 0/10)
- *(flutter)* attach library doc comment with library directive (dangling doc comment INFO)
- *(flutter)* document ValidationResult constructor, fromJson and toJson (pub.dev: 3 undocumented API elements)
- *(kotlin)* bump AGP to 8.13.0 (vanniktech 0.37.0 requires AGP >= 8.13.0)
- *(kotlin)* bump Gradle wrapper to 8.13 (AGP 8.13 requires Gradle >= 8.13)
- *(kotlin)* install Build Tools 35.0.0 + API 34 platform in CI (AGP 8.13 default)
- *(flutter)* silence avoid_print in console example (example.dart)
- *(kotlin)* import DeploymentValidation in module build script
- *(swift)* regenerate bindings with --no-format in release workflow
- *(swift)* build dispatch runs from the dispatch ref, tag only names the release
- *(swift)* merge macOS static libs into one universal binary for the XCFramework
- *(swift)* point slice modulemap at sibling Headers dir so canImport resolves
- *(swift)* also place modulemap in slice Headers dir for SwiftPM discovery
- *(php-split)* persist-credentials false so the PAT is used, not GITHUB_TOKEN

### Other

- *(flutter)* build example app on Linux and Android
- *(php)* add split-repo CI (carried to indycheck-php root by subtree split)
- *(php)* add subtree-split sync workflow for the Packagist split repo
- *(release-pr)* serialize runs with a concurrency group (fix force-push race)

## [0.2.3](https://github.com/dusmamud/indycheck/compare/indycheck-v0.2.2...indycheck-v0.2.3) - 2026-11-12

### Added

- *(ffi)* add generate_* exports and staticlib target
- *(flutter)* add Dart package over the C API (dart:ffi)
- *(php)* add PHP FFI package

### Fixed

- *(ci)* npm OIDC publish needs npm 11 and no NODE_AUTH_TOKEN
- *(napi)* add napi-build setup so the macOS link finds N-API symbols
- *(flutter)* import package:ffi/ffi.dart for Utf8
- *(ci)* add Kotlin stdlib to the runtime classpath
- *(ci)* pass the UniFFI modulemap explicitly to swiftc
- *(ci)* check the C header for drift on Linux only
- *(ci)* build the C library for the GNU target on Windows
- *(go)* link Windows system libs the Rust std needs on MinGW
- *(go)* also link ntdll on Windows (Nt*/Rtl* symbols)
- *(napi)* add darwin-arm64 + linux-x64-musl to napi triples

### Other

- add test workflows for go/kotlin/swift/c/napi/flutter/php
- add C prebuilt-archives release workflow
- add napi prebuilds + npm publish workflow

## [0.2.2](https://github.com/dusmamud/indycheck/compare/indycheck-v0.2.1...indycheck-v0.2.2) - 2026-11-12

### Added

- *(generators)* add generate_vehicle and generate_vehicle_bharat
- *(generators)* add generate_vehicle and generate_vehicle_bharat
- *(generators)* add generate_vehicle and generate_vehicle_bharat
- *(generators)* add generate_vehicle and generate_vehicle_bharat
- *(cli)* add update command and generate vehicle kinds
- *(cli)* add update command and generate vehicle kinds

### Other

- use indycheck.pages.dev, polish color/responsive/UI
