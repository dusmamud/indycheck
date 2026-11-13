# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
