# indycheck-napi — Phase 2 scaffold

Node.js bindings for indycheck, built with napi-rs. **Not finished in v0.1.**

What exists: thin Rust wrappers in `src/lib.rs` that call the core crate
and return JSON strings. What is missing (Phase 2 work): `package.json`,
napi build configuration, prebuilt binaries / CI, and published npm package
tests. Do not publish this crate yet.
