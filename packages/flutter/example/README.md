# indycheck example app

A small Flutter app for the [`indycheck`](../) package: type a PAN or
Aadhaar number and validate it offline. The prefilled value (`ABCDE1234F`)
is test data, not a real issued ID.

The native library needs no setup in this app — the package's build hook
(`../hook/build.dart`) downloads the prebuilt `libindycheck_ffi` for the
target platform from the indycheck GitHub release (or builds it from the
Rust sources) and bundles it automatically.

## Run it

Requires Flutter 3.50+ (ships Dart 3.14+).

```sh
flutter pub get
flutter run            # Linux desktop, or any connected device
flutter test           # widget tests (validate PAN / Aadhaar)
flutter build linux    # Linux desktop bundle
flutter build apk      # Android APK (needs the Android SDK)
```

## Platforms

- Linux and Android are built in CI (`.github/workflows/flutter.yml`).
- iOS, macOS, Windows and web are NOT built in CI — there is no runner
  for them in this workflow and this example has no runner folders for
  them. The hook does have prebuilt archives for darwin-arm64/x64,
  win32-x64-msvc/gnu and ios-arm64/ios-simulator in the indycheck
  releases, so those platforms can be built from a machine running them.
