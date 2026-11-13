## 0.2.5

- Version bump in lockstep with indycheck 0.2.5. No API changes.
- pub.dev publishing fixed: the release workflow now publishes with the
  standalone Dart SDK (`dart-lang/setup-dart` + `dart pub publish`),
  so this version reaches pub.dev (0.2.4's publish needed that fix).

## 0.2.4

- Version bump in lockstep with indycheck 0.2.4. No API changes.
- Published to pub.dev as 0.2.4 (0.2.3 was skipped on pub.dev).

## 0.2.3

- Native library is now bundled automatically: a build hook
  (`hook/build.dart`, Dart build hooks + `package:code_assets`)
  downloads the prebuilt library for the target platform from the
  indycheck GitHub release and bundles it with the app, so most users
  no longer need to build it with Cargo or set
  `INDYCHECK_NATIVE_LIB`. When no release archive exists yet, the
  hook falls back to a local Cargo build.
- The Dart loader now resolves the bundled library as a code asset
  (`DynamicLibrary.codeAsset('package:indycheck/indycheck_ffi')`),
  after an explicit path / `INDYCHECK_NATIVE_LIB` and before
  `DynamicLibrary.process()` on Android/iOS. Public API unchanged.
- Minimum Dart SDK raised to 3.14.0 (`DynamicLibrary.codeAsset` is
  a 3.14 API, although the hook packages themselves only need 3.10);
  `hooks`, `code_assets`, `archive` and `crypto` added as
  dependencies (used by the build hook).

## 0.2.2

- Initial Dart / Flutter package.
- Pure Dart package (no Flutter plugin): hand-written `dart:ffi`
  bindings over the C API in `crates/indycheck-ffi`, same public API
  shape as the Go, JS and Python bindings.
- 14 validators (PAN, Aadhaar, GSTIN, mobile, vehicle incl. Bharat
  BH series, IFSC, UPI, PIN code, TAN, CIN, LLPIN, Voter ID / EPIC),
  plus `detect`, `validateMany` and `version`.
- Test-data generators: `generatePan`, `generateAadhaar`,
  `generateGstin`, `generateMobile`, `generateVehicle` and
  `generateVehicleBharat`.
- Native library loaded from an explicit `Indycheck.init` /
  `setLibraryPath` path, the `INDYCHECK_NATIVE_LIB` environment
  variable, or the platform default library file name; a clear
  `StateError` is thrown when it cannot be found.
