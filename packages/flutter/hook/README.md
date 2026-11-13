# indycheck build hook (`hook/build.dart`)

A [Dart build hook](https://dart.dev/tools/hooks) that provides the
native library (`crates/indycheck-ffi`) for the `indycheck` Dart
package. It downloads the prebuilt library for the target platform
from the indycheck GitHub release and registers it as the code asset
`package:indycheck/indycheck_ffi` (link mode `DynamicLoadingBundled`),
so the Dart code loads it with
`DynamicLibrary.codeAsset('package:indycheck/indycheck_ffi')`.

No `ffiPlugin`, no per-platform build files — the hook is the whole
mechanism. The same approach is used by `quickjs-dart`, `llamadart`
and `maplibre`.

## How it picks the archive

1. **Version** — read from this package's `pubspec.yaml` at runtime
   (the `version:` line), never hardcoded. Version 0.2.3 therefore
   downloads from `indycheck-v0.2.3` with no hook change.
2. **Base URL** — by default
   `https://github.com/dusmamud/indycheck/releases/download/indycheck-v<version>/`,
   overridden by `release_base_url` (see below).
3. **Target** — from the build config (`CodeConfig.targetOS` /
   `targetArchitecture`, plus `iOS.targetSdk` for device vs simulator):

   | Target | Archive | Library inside |
   |---|---|---|
   | Linux x64 (glibc) | `indycheck-<ver>-linux-x64-gnu.tar.gz` | `libindycheck_ffi.so` |
   | Linux x64 (musl) | `indycheck-<ver>-linux-x64-musl.tar.gz` | static-only (`libindycheck_ffi.a`, no `.so`) — the hook refuses it, see below |
   | macOS arm64 | `indycheck-<ver>-darwin-arm64.tar.gz` | `libindycheck_ffi.dylib` |
   | macOS x64 | `indycheck-<ver>-darwin-x64.tar.gz` | `libindycheck_ffi.dylib` |
   | Windows x64 (MSVC) | `indycheck-<ver>-win32-x64-msvc.zip` | `indycheck_ffi.dll` |
   | Windows x64 (GNU) | `indycheck-<ver>-win32-x64-gnu.zip` | `indycheck_ffi.dll` |
   | Android arm64-v8a | `indycheck-<ver>-android-arm64-v8a.tar.gz` | `libindycheck_ffi.so` |
   | Android armeabi-v7a | `indycheck-<ver>-android-armeabi-v7a.tar.gz` | `libindycheck_ffi.so` |
   | Android x86 | `indycheck-<ver>-android-x86.tar.gz` | `libindycheck_ffi.so` |
   | Android x86_64 | `indycheck-<ver>-android-x86_64.tar.gz` | `libindycheck_ffi.so` |
   | iOS arm64 (device) | `indycheck-<ver>-ios-arm64.tar.gz` | `libindycheck_ffi.a` |
   | iOS simulator | `indycheck-<ver>-ios-simulator.tar.gz` | `libindycheck_ffi.a` (arm64 only) |

   Windows x64 uses the GNU archive only when `gnu` is set (see
   below). Linux x64 musl: the musl archive is static-only, so the
   hook does not download it — selecting musl (`musl` user-define or
   `INDYCHECK_MUSL=1`) fails fast with guidance on building a
   dynamically-linked musl `.so` yourself and pointing `native_lib`
   at it. Targets with no prebuilt archive (e.g. Linux arm64, Windows
   arm64) go straight to the source fallback on host machines, and
   fail with a clear error otherwise.

4. **Extraction** — the archive is extracted (pure Dart, via
   `package:archive`, no `tar`/`unzip` subprocess) into the hook's
   shared output directory, and the library file is registered from
   there. Entries that would escape the extract directory (`..`,
   absolute paths) are skipped.

## How it verifies the download

- The hook fetches `SHA256SUMS.txt` from the same release directory
  (published by `.github/workflows/c-release.yml` since 0.2.3) and
  checks the archive's SHA-256 against it.
- If the sums file is missing or unreachable — releases before 0.2.3
  have none — the hook logs that it is skipping the SHA-256 check
  and instead verifies the extracted library exists, is non-empty
  and has the expected file name.
- A SHA-256 mismatch on a cached archive deletes the cache and
  re-downloads once; a mismatch on a fresh download is refused
  outright (the hook throws, naming the cached file to delete).

Downloads are cached under `.dart_tool/indycheck/<base-url-hash>/`
in the package directory (keyed by the base URL, so a fake local
release and the real GitHub release never share a cached archive),
so repeated builds do not re-download.

## Fallback: building from source

If the download fails (no release yet, 404, no network, or a
download that stalls — HTTP fetches time out after 120s for the
archive, 30s for `SHA256SUMS.txt`, instead of hanging the build
forever), the hook builds the library locally with:

```sh
cargo build -p indycheck-ffi --release
```

Cargo is found on `PATH` first, then in the default rustup
location (`~/.cargo/bin/cargo`, `%USERPROFILE%\.cargo\bin\cargo.exe`
on Windows), so a GUI-launched or bare shell without cargo on
`PATH` still works.

That only happens when the target matches the host (same OS and
architecture) and the Rust sources are present — i.e. a checkout of
the indycheck repo (`crates/indycheck-ffi/Cargo.toml` must exist).
For cross targets (Android, iOS, …) the hook fails with a clear
error naming the archive URL and the exact local build command
(including `--target <triple>`) instead of silently producing a
wrong-architecture library. When the package is installed from
pub.dev (no Rust sources shipped), the error says so and points at
the archive URL and the `native_lib` override.

## Configuration

Two channels, same keys — **user-defines win over environment
variables**:

```yaml
# in the root package's (or app's) pubspec.yaml
hooks:
  user_defines:
    indycheck:
      release_base_url: /path/to/a/local/release/dir
      native_lib: /path/to/libindycheck_ffi.so
      musl: true
      gnu: true
```

| User-define | Environment variable | Meaning |
|---|---|---|
| `release_base_url` | `INDYCHECK_RELEASE_BASE_URL` | Override the download base URL. Accepts an `https://` / `http://` URL, a `file://` URL, or a plain directory path. |
| `native_lib` | `INDYCHECK_NATIVE_LIB` | Use this library file directly, no download. Same variable the Dart tests and `Indycheck.init()` read. |
| `musl` | `INDYCHECK_MUSL=1` | Linux x64: request the musl archive — which is static-only, so the hook fails fast with guidance instead of downloading it. |
| `gnu` | `INDYCHECK_GNU=1` | Windows x64: use the GNU (MinGW) archive instead of MSVC. |

Why two channels: the Dart/Flutter SDK runs hooks in a
semi-hermetic environment and strips most environment variables
(see [dart.dev/tools/hooks](https://dart.dev/tools/hooks) —
`INDYCHECK_*` is not on the pass-through list), so under
`dart test` / `flutter build` only the user-defines are reliably
visible. The environment variables work when the hook is run
directly (e.g. `dart hook/build.dart` with a hook input file, or
via the `testCodeBuildHook` test helper), and `INDYCHECK_NATIVE_LIB`
is still honoured by the Dart library itself at runtime.

Web targets have no code config, so the hook emits no asset and
succeeds without doing anything.

## The hook's own package (`hook/pubspec.yaml`)

The hook is a separate mini-package (`indycheck_hook`) so the SDK
can resolve its dependencies independently of the main package.
Dependencies, all current for Dart SDK 3.14.0:

- `hooks: ^2.2.0` and `code_assets: ^2.2.0` — the hook protocol.
- `archive: ^4.0.0` — `.tar.gz` / `.zip` extraction in pure Dart.
- `crypto: ^3.0.0` — SHA-256 verification.
- Downloads use `dart:io` `HttpClient` only (no `http` package).

SDK floor: `>=3.14.0 <4.0.0`. Build hooks exist since Dart 3.10,
but the loader uses `DynamicLibrary.codeAsset`, a Dart 3.14 API,
so the package requires Dart 3.14 (Flutter 3.50+).

## How to test it

### 1. Hook itself

```sh
cd packages/flutter/hook
dart pub get
dart analyze   # 0 issues
dart format --output=none --set-exit-if-changed build.dart
```

### 2. Download path, without a real GitHub release

Build the C library, stage a fake release directory the same way
`.github/workflows/c-release.yml` does, and point the hook at it:

```sh
cargo build -p indycheck-ffi --release

mkdir -p /tmp/fake-release/indycheck-0.2.3-linux-x64-gnu
cp crates/indycheck-ffi/indycheck.h LICENSE /tmp/fake-release/indycheck-0.2.3-linux-x64-gnu/
cp target/release/libindycheck_ffi.so target/release/libindycheck_ffi.a \
  /tmp/fake-release/indycheck-0.2.3-linux-x64-gnu/
cd /tmp/fake-release
tar -czf indycheck-0.2.3-linux-x64-gnu.tar.gz indycheck-0.2.3-linux-x64-gnu
sha256sum indycheck-*.tar.gz > SHA256SUMS.txt
```

Then run the package tests with the override (user-define in a
scratch consumer project — see below — because the SDK strips
environment variables from hooks under `dart test`):

```yaml
# scratch consumer's pubspec.yaml
hooks:
  user_defines:
    indycheck:
      release_base_url: /tmp/fake-release
```

The hook log should show the download from the fake base URL, the
`SHA-256 verified` line, the extraction, and the registered asset
`package:indycheck/indycheck_ffi`. A consumer test that calls the
native `indycheck_version` symbol through
`DynamicLibrary.codeAsset('package:indycheck/indycheck_ffi')`
proves the whole chain end to end.

To test the no-sums fallback, delete `SHA256SUMS.txt` from the fake
release and re-run: the hook logs that it is skipping SHA-256
verification and checks the extracted library instead.

### 3. Fallback path (no release at all)

Point the base URL at an empty directory (or an unreachable host):

```yaml
hooks:
  user_defines:
    indycheck:
      release_base_url: /tmp/empty-dir
```

The hook logs the failed download, builds with Cargo from the repo
checkout, and the tests pass against the locally built library.

### 4. Real release

Once the `indycheck-v0.2.3` tag's archives are attached to the
GitHub release, plain `dart test` in `packages/flutter` (no
overrides) downloads
`indycheck-0.2.3-linux-x64-gnu.tar.gz` from
`https://github.com/dusmamud/indycheck/releases/download/indycheck-v0.2.3/`
and verifies it against the release's `SHA256SUMS.txt`.
