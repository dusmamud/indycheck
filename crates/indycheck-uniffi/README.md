# indycheck-uniffi

UniFFI bindings (Kotlin/Swift) for
[indycheck](https://github.com/dusmamud/indycheck) — offline Indian ID
validation (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN code, TAN, CIN,
LLPIN, Voter ID / EPIC, vehicle numbers including Bharat (BH) series).

This is a thin wrapper: all validation logic lives in the core `indycheck`
crate. Every function here calls the matching core validator and returns a
`ValidationResult` with `{valid, code, reason_en, reason_hi, parsed}`,
where `parsed` is the structured data the validator extracted, as a JSON
string (or `null` when there is none — e.g. invalid input). Keeping
`parsed` as JSON keeps the interface identical in Kotlin and Swift, the
same approach the napi binding uses.

This crate is never published to crates.io (`publish = false`); only the
core `indycheck` crate is published.

## API

| Function | Returns |
| --- | --- |
| `validatePan(input)` | `ValidationResult` |
| `validateAadhaar(input)` | `ValidationResult` |
| `validateGstin(input)` | `ValidationResult` |
| `validateIfsc(input)` | `ValidationResult` |
| `validateUpi(input)` | `ValidationResult` |
| `validateMobile(input)` | `ValidationResult` |
| `validatePincode(input)` | `ValidationResult` |
| `validateVehicle(input)` | `ValidationResult` (incl. Bharat `22BH1234AA`) |
| `validateTan(input)` | `ValidationResult` |
| `validateCin(input)` | `ValidationResult` |
| `validateLlpin(input)` | `ValidationResult` |
| `validateVoterId(input)` | `ValidationResult` |
| `detect(input)` | `String` (`"pan"`, `"aadhaar"`, … or `"unknown"`) |
| `validateMany(inputs)` | `[ValidationResult]` / `List<ValidationResult>` |

`ValidationResult.valid` is true only on success; `code` is `"VALID"` then,
otherwise a stable error code such as `"INVALID_CHECKSUM"`.
`reason_en` / `reason_hi` are human-readable explanations in English and
Hindi. `parsed` (JSON) holds e.g. a vehicle's `series_type`
(`"state"` / `"bharat"`), `year`, `number`, `suffix` for BH numbers.

Honest limits (same as the core): format and checksum only. This does
**not** verify that an ID really exists or belongs to anyone.

## Kotlin usage

The generated bindings live in `bindings/kotlin/` (package
`uniffi.indycheck_uniffi`, file `indycheck_uniffi.kt`). Build the Rust
core as a shared library for your target (e.g. Android `libindycheck_uniffi.so`
via `cargo build -p indycheck-uniffi`), put the `.kt` file in your project,
and load the library (the generated code does this via JNA).

```kotlin
import uniffi.indycheck_uniffi.*

val pan = validatePan("ABCDE1234F")
println(pan.valid)      // true
println(pan.code)       // VALID
println(pan.reasonHi)   // PAN ka format sahi hai. ...

val bh = validateVehicle("22BH1234AA")
println(bh.valid)       // true
println(bh.parsed)      // {"number":"1234","registration":"22BH1234AA","series":"BH","series_type":"bharat","suffix":"AA","year":"22"}

val batch = validateMany(listOf("ABCDE1234F", "9876543210", "not-an-id"))
println(batch.map { it.valid })  // [true, true, false]

println(detect("dus@okaxis"))    // upi
```

`parsed` is a JSON string — parse it with your preferred JSON library
(e.g. `org.json.JSONObject` or kotlinx-serialization).

## Swift usage

The generated bindings live in `bindings/swift/`:
`indycheck_uniffi.swift`, plus the C header `indycheck_uniffiFFI.h` and
`indycheck_uniffiFFI.modulemap`, which expose the Rust shared library
(build it with `cargo build -p indycheck-uniffi` and link the resulting
`libindycheck_uniffi` / `.xcframework` into your Xcode project).

```swift
import indycheck_uniffi

let pan = validatePan(input: "ABCDE1234F")
print(pan.valid)     // true
print(pan.code)      // VALID
print(pan.reasonHi)  // PAN ka format sahi hai. ...

let bh = validateVehicle(input: "22BH1234AA")
print(bh.valid)      // true
print(bh.parsed ?? "")  // {"number":"1234",...,"series_type":"bharat",...,"year":"22"}

let batch = validateMany(inputs: ["ABCDE1234F", "9876543210", "not-an-id"])
print(batch.map(\.valid))  // [true, true, false]

print(detect(input: "dus@okaxis"))  // upi
```

`parsed` is a JSON string — decode it with `JSONSerialization` or
`Codable` as needed.

## Regenerating the bindings

Requires UniFFI **0.28.3**. The `uniffi-bindgen` binary is not published
as a cargo-installable crate in 0.28.x, so build the CLI from a small
throwaway crate instead:

```sh
# one-off: build a uniffi-bindgen 0.28.3 CLI binary
mkdir -p /tmp/uniffi-cli/src && cd /tmp/uniffi-cli
cat > Cargo.toml <<'EOF'
[package]
name = "uniffi-cli"
version = "0.1.0"
edition = "2021"

[dependencies]
uniffi = { version = "=0.28.3", features = ["cli"] }
EOF
printf 'fn main() { uniffi::uniffi_bindgen_main() }\n' > src/main.rs
cargo build --release   # -> target/release/uniffi-cli
```

Then, from the repo root:

```sh
cargo build -p indycheck-uniffi
uniffi-cli generate --library target/debug/libindycheck_uniffi.so \
    --language kotlin --out-dir crates/indycheck-uniffi/bindings/kotlin
uniffi-cli generate --library target/debug/libindycheck_uniffi.so \
    --language swift --out-dir crates/indycheck-uniffi/bindings/swift
```

Generation is deterministic: deleting `bindings/` and regenerating
produces byte-identical output. (`ktlint` / `swiftformat` are optional
formatters; if absent, uniffi-bindgen prints a warning and continues.)

## Verifying

```sh
cargo build -p indycheck-uniffi
cargo test -p indycheck-uniffi
cargo fmt -p indycheck-uniffi -- --check
cargo clippy -p indycheck-uniffi --all-targets
```

Note: compiling the generated Kotlin/Swift sources needs `kotlinc` /
`swiftc` (not installed in this environment), so the generated bindings
are verified by generation + byte-identical regeneration, not by a
Kotlin/Swift compile.
