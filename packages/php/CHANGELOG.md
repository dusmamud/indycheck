# Changelog

All notable changes to the indycheck PHP package are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
All indycheck packages share one version in lockstep.

## [0.2.2] - 2026-11-12

### Added
- Initial PHP package (`dusmamud/indycheck`): FFI binding over the C API
  in `crates/indycheck-ffi`, for PHP >= 8.1 (tested on 8.2 and 8.3).
- `Indycheck` static class with all 12 validators (PAN, Aadhaar, GSTIN,
  mobile, vehicle incl. Bharat BH series, IFSC, UPI, PIN code, TAN, CIN,
  LLPIN, Voter ID / EPIC), `detect()`, batch `validateMany()`,
  `version()`, and the six test-data generators — all returning the same
  associative-array shape as the Rust core's JSON.
- Native library resolution via `INDYCHECK_LIB_PATH`, then
  `vendor/dusmamud/indycheck/lib/`, then the cargo build output under
  `target/release/` — with a clear `RuntimeException` (including the
  `cargo build -p indycheck-ffi --release` command) when it is not found.
- `scripts/setup.php`: CLI setup check (PHP version, ext-ffi,
  `ffi.enable=true`, ext-json, native library) with the exact php.ini /
  PHP-FPM instructions when `ffi.enable` is not `true`.
- PHPUnit 10 tests covering the main validators, Bharat vehicle
  detection, batch order, generator round-trips, and the version string.
