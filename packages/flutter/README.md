# indycheck — Dart / Flutter binding for indycheck

Dart and Flutter binding for [indycheck](https://github.com/dusmamud/indycheck), the
offline Indian ID validator (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile,
PIN code, TAN, CIN, LLPIN, Voter ID / EPIC, vehicle registration —
including Bharat (BH) series numbers such as `22BH1234AA`).

It is a thin [`dart:ffi`](https://api.dart.dev/stable/dart-ffi/dart-ffi-library.html)
wrapper over the C API in `crates/indycheck-ffi`, which itself is a thin
wrapper over the Rust core in `crates/indycheck`. **No validation logic
lives in this package** — every function calls the matching C function
and decodes the JSON result it returns, so Dart returns the same answer
as Rust for the same input. The FFI bridge is the current implementation;
a generated bridge (e.g. flutter_rust_bridge) could replace it later
without changing this public API.

This is a pure Dart package, not a Flutter plugin: it works in a Dart
CLI or server, and in a Flutter app that bundles the native library
(see [Native library](#native-library)).

## Install

```sh
dart pub add indycheck
# or, in a Flutter app:
flutter pub add indycheck
```

## Native library

The native library is bundled automatically: a build hook
(`hook/build.dart`, using Dart's [build hooks](https://dart.dev/tools/hooks))
downloads the prebuilt library for your platform from the
[indycheck GitHub release](https://github.com/dusmamud/indycheck/releases)
and bundles it with your app, so in most cases no setup is needed —
just `dart pub add indycheck` and use it. No Rust toolchain is needed
on the consuming machine, and this package is still a pure Dart
package, not a Flutter plugin (no `flutter: plugin:` section, no
per-platform CMake or podspec).

| Platform | Archive (from the GitHub release) | Bundled library |
|---|---|---|
| Linux x64 (glibc) | `indycheck-<version>-linux-x64-gnu.tar.gz` | `libindycheck_ffi.so` |
| Linux x64 (musl) | `indycheck-<version>-linux-x64-musl.tar.gz` | not usable by Dart — the musl archive is static-only (`libindycheck_ffi.a`, no `.so`), so the hook fails fast on musl with guidance instead of downloading it |
| macOS arm64 | `indycheck-<version>-darwin-arm64.tar.gz` | `libindycheck_ffi.dylib` |
| macOS x64 | `indycheck-<version>-darwin-x64.tar.gz` | `libindycheck_ffi.dylib` |
| Windows x64 (MSVC) | `indycheck-<version>-win32-x64-msvc.zip` | `indycheck_ffi.dll` |
| Windows x64 (GNU) | `indycheck-<version>-win32-x64-gnu.zip` | `indycheck_ffi.dll` |
| Android arm64-v8a / armeabi-v7a / x86 / x86_64 | `indycheck-<version>-android-<abi>.tar.gz` | `libindycheck_ffi.so` |
| iOS arm64 / iOS simulator (arm64) | `indycheck-<version>-ios-arm64.tar.gz` / `indycheck-<version>-ios-simulator.tar.gz` | `libindycheck_ffi.a` (linked into the app) |

> Android and iOS archives ship with the 0.2.3 release. On a platform
> with no release archive yet (or when the download fails), the hook
> falls back to building the library locally with Cargo (see below).

### Local build fallback

When no release archive exists for your platform yet (or the download
fails), the hook builds the library locally from the Rust sources
instead. That needs a Rust toolchain and the indycheck repo checked
out; the hook runs the equivalent of:

```sh
cargo build -p indycheck-ffi --release
```

That produces `target/release/libindycheck_ffi.so` (Linux),
`libindycheck_ffi.dylib` (macOS) or `indycheck_ffi.dll` (Windows).

### Overriding the library

To use a different library instead of the bundled one, point the
package at it, either with an environment variable:

```sh
INDYCHECK_NATIVE_LIB=/path/to/libindycheck_ffi.so dart run
```

or explicitly in code, before the first validation call:

```dart
import 'package:indycheck/indycheck.dart';

Indycheck.init('/path/to/libindycheck_ffi.so');
// or: Indycheck.setLibraryPath('/path/to/libindycheck_ffi.so');
```

Resolution order: the explicit path passed to `init` /
`setLibraryPath` first, then `INDYCHECK_NATIVE_LIB`, then the native
asset bundled by the build hook. On Android and iOS the library may
also be linked into the app binary (`DynamicLibrary.process()`). If
the library cannot be loaded, the package throws a `StateError`
naming the expected file and the `cargo build` command above — it
never fails silently.

> The `.so` / `.dylib` / `.dll` is a build artefact, not a source: it is
> never committed to the repo.

### Requirements

The build hook needs Dart **>= 3.14** — this package declares
`sdk: '>=3.14.0 <4.0.0'`. Build hooks themselves were stabilised in
Dart 3.10, but the loader uses `DynamicLibrary.codeAsset`, which is
a Dart 3.14 API. In a Flutter app that means Flutter 3.50+, which
ships Dart 3.14. The hook itself needs network access to download
the release archive, or a local Rust toolchain for the fallback
build.

## Usage

```dart
import 'package:indycheck/indycheck.dart';

final pan = Indycheck.validatePan('ABCDE1234F');
if (pan.valid) {
  print('${pan.code} ${pan.parsed?['entity']} ${pan.parsed?['entity_code']}');
} else {
  print('${pan.code} ${pan.reasonEn} / ${pan.reasonHi}');
}

// Bharat (BH) series vehicle number
final vehicle = Indycheck.validateVehicle('22BH1234AA');
print('${vehicle.valid} ${vehicle.parsed?['series_type']} '
    '${vehicle.parsed?['year']} ${vehicle.parsed?['suffix']}');

// Detect the type first, then validate a batch in one call
print(Indycheck.detect('9876543210')); // mobile
final batch = Indycheck.validateMany(['ABCDE1234F', '9876543210', 'nope']);
```

## API

Every validator returns a `ValidationResult`. A failed validation is
a normal result with `valid == false` and a stable `code`
(`INVALID_FORMAT`, `INVALID_LENGTH`, `EMPTY`, …); the methods only
throw on transport failures (library not loaded, or a null return).

```dart
class ValidationResult {
  final bool valid;
  final String code; // 'VALID' on success
  final String reasonEn;
  final String reasonHi; // Roman-script Hinglish, as the Rust core returns it
  final Map<String, dynamic>? parsed; // extracted fields on success, null otherwise
}
```

| Function | Validates |
|---|---|
| `validatePan` | PAN, e.g. `ABCDE1234F` |
| `validateAadhaar` | 12-digit Aadhaar (Verhoeff checksum) |
| `validateGstin` | 15-character GSTIN |
| `validateMobile` | Indian mobile (`+91` / `91` / `0` prefix, spaces/hyphens OK) |
| `validateVehicle` / `validateVehicleRegistration` | State format (`DL01AB1234`) or Bharat series (`22BH1234AA`) |
| `validateIfsc` | IFSC (11 characters) |
| `validateUpi` | UPI ID (`name@handle`) |
| `validatePincode` | 6-digit PIN code |
| `validateTan` | TAN (format only) |
| `validateCin` | CIN (format only) |
| `validateLlpin` | LLPIN |
| `validateVoterId` / `validateEpic` | Voter ID / EPIC |
| `detect` | Returns the type string (`"pan"`, `"mobile"`, `"vehicle"`, …, `"unknown"`) |
| `validateMany(List<String>)` | Batch: validates each input, results in input order |
| `version()` | Core version string, e.g. `"0.2.2"` |

## Generators — TEST DATA ONLY

```dart
Indycheck.generatePan(); // e.g. "XKQPW4821M" — mock test data only, never a real PAN
Indycheck.generatePan(entity: 'C'); // entity Company (unknown char -> "P")
Indycheck.generateAadhaar(); // 12 digits, correct Verhoeff check digit
Indycheck.generateGstin(); // valid GSTIN for Assam ("18")
Indycheck.generateGstin(stateCode: '27'); // ... for Maharashtra
Indycheck.generateMobile(); // 10 digits, first digit 6-9
Indycheck.generateVehicle(); // e.g. "DL01AB1234"
Indycheck.generateVehicleBharat(); // e.g. "22BH1234AA"
```

**Warning: generated values are syntactically valid, not real issued
IDs.** They pass this library's own validators but were never issued
by UIDAI, Income Tax, GSTN or anyone else. Use them only in tests,
demos and form previews — never present them as a real person's ID.
Generators are intentionally unseeded: each call may return a
different value.

## Running the tests

```sh
cargo build -p indycheck-ffi --release
INDYCHECK_NATIVE_LIB=../../target/release/libindycheck_ffi.so dart test
```

With the build hook in place, plain `dart test` is enough — the hook
downloads (or locally builds) the library and the tests load the
bundled asset; the `INDYCHECK_NATIVE_LIB` form above is for testing a
specific local build instead.

## Honest limits (same as the core)

- **Format + checksum only.** A `valid: true` result means the value is
  well-formed and its checksum is correct — not that the ID exists or
  belongs to anyone.
- No checks against UIDAI (Aadhaar), NSDL / Income Tax (PAN), GSTN
  (GSTIN), any bank (IFSC), or any UPI provider. This package makes no
  network requests at all.
- **PAN, IFSC, TAN, CIN, LLPIN, Voter ID and vehicle registration
  numbers have no public checksum.** Only their format is checked.
  The vehicle state-code letters are not checked against a list of
  states, and a format-valid vehicle number does not prove the vehicle
  exists.
- IFSC validation is format-only: it cannot tell you whether a branch
  code really exists.
- UPI validation checks the handle against a built-in list of common
  handles; a new or rare handle may be reported as unknown.
