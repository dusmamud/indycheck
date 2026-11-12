//! Build script for the napi-rs addon.
//!
//! `napi_build::setup()` emits the platform link flags the addon
//! needs: on macOS it adds `-undefined dynamic_lookup`, so the N-API
//! symbols (resolved at load time by Node) do not fail the link;
//! on Windows it links the Node stub library; on Linux it is a
//! no-op. Without this, the macOS build fails with
//! `ld: symbol(s) not found for architecture arm64`.

fn main() {
    napi_build::setup();
}
