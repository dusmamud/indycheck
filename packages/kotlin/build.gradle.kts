// Top-level build file for the indycheck Kotlin/Android library.
// Plugin versions are pinned here (single place); the library version lives
// in gradle.properties as `indycheckVersion` and is synced by
// scripts/sync-versions.sh from the root Cargo.toml (lockstep with the
// Rust core, 0.2.3 at the time of writing).
plugins {
    id("com.android.library") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.1.20" apply false
    id("com.vanniktech.maven.publish") version "0.37.0" apply false
}
