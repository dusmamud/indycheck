#!/usr/bin/env bash
# Build libindycheck_uniffi.so for the 4 Android ABIs with cargo-ndk and
# stage the .so files into the module's jniLibs dir, so the AAR is
# self-contained (an app must NOT need Rust installed).
#
# Requires: cargo-ndk, the Android NDK (ANDROID_NDK_HOME), and the 4
# Android Rust targets:
#   rustup target add aarch64-linux-android armv7-linux-androideabi \
#       i686-linux-android x86_64-linux-android
#   cargo install cargo-ndk --version 4.1.2 --locked
#
# Called by the Gradle `buildNativeLibs` task (which runs before preBuild);
# safe to run by hand too (idempotent — rebuilds only what changed).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

: "${ANDROID_NDK_HOME:?ANDROID_NDK_HOME must be set (path to the Android NDK)}"
command -v cargo-ndk >/dev/null || {
    echo "cargo-ndk not found (cargo install cargo-ndk --version 4.1.2 --locked)" >&2
    exit 1
}

cargo ndk -t armeabi-v7a -t arm64-v8a -t x86 -t x86_64 --platform 21 \
    build -p indycheck-uniffi --release

declare -A TRIPLES=(
    [armeabi-v7a]=armv7-linux-androideabi
    [arm64-v8a]=aarch64-linux-android
    [x86]=i686-linux-android
    [x86_64]=x86_64-linux-android
)

for abi in armeabi-v7a arm64-v8a x86 x86_64; do
    triple="${TRIPLES[$abi]}"
    dest="packages/kotlin/indycheck/src/main/jniLibs/$abi"
    mkdir -p "$dest"
    cp "target/$triple/release/libindycheck_uniffi.so" "$dest/"
    echo "staged $dest/libindycheck_uniffi.so"
done
