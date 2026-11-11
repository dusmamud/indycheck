// Phase 3 / last — scaffold only, not in v0.1.
// UniFFI bindings (Kotlin/Swift) will live here. No logic here; the core
// crate `indycheck` is the only implementation. This crate is excluded
// from the workspace members in the root Cargo.toml so it cannot break
// `cargo test --workspace`.

pub use indycheck::*;
