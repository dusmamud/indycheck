# indycheck-ffi — C API for indycheck

C FFI bindings for [indycheck](https://github.com/dusmamud/indycheck),
the offline Indian ID validator. This crate is the C API behind the
Go binding in `packages/go` — any language that can call C can use it.

It is a **thin wrapper** over the core crate `crates/indycheck`: no
validation logic lives here. Every exported function calls the
matching core validator and serialises its `ValidationResult` to JSON.

This crate is a workspace member with `publish = false` — it is never
published to crates.io on its own; only the core `indycheck` crate is
published.

## Build

```sh
cargo build -p indycheck-ffi --release
```

This produces `target/release/libindycheck_ffi.so` (and
`libindycheck_ffi.rlib` for Rust consumers). The `.so` is a build
artefact and is never committed.

## C API (`indycheck.h`)

The header is generated with
[`cbindgen`](https://github.com/mozilla/cbindgen) — re-generate it
after changing the exported functions:

```sh
cargo install cbindgen
cbindgen --config cbindgen.toml --crate indycheck-ffi --output indycheck.h
```

### Functions

Every function returning `char *` returns a heap-allocated,
NUL-terminated UTF-8 string **owned by the caller**. Release it with
`indycheck_free_string()` — never `free()` it directly, never free
the same pointer twice. A null return means allocation failed; do not
dereference it.

| Function | Returns |
|---|---|
| `indycheck_validate_pan(input)` | JSON result |
| `indycheck_validate_aadhaar(input)` | JSON result |
| `indycheck_validate_gstin(input)` | JSON result |
| `indycheck_validate_mobile(input)` | JSON result |
| `indycheck_validate_vehicle(input)` | JSON result — state (`DL01AB1234`) or Bharat (BH) series (`22BH1234AA`) |
| `indycheck_validate_vehicle_registration(input)` | alias for `validate_vehicle` |
| `indycheck_validate_ifsc(input)` | JSON result |
| `indycheck_validate_upi(input)` | JSON result |
| `indycheck_validate_pincode(input)` | JSON result |
| `indycheck_validate_tan(input)` | JSON result |
| `indycheck_validate_cin(input)` | JSON result |
| `indycheck_validate_llpin(input)` | JSON result |
| `indycheck_validate_voter_id(input)` | JSON result |
| `indycheck_validate_epic(input)` | alias for `validate_voter_id` |
| `indycheck_detect(input)` | plain type string, **not JSON**: `"pan"`, `"aadhaar"`, `"gstin"`, `"ifsc"`, `"upi"`, `"mobile"`, `"pincode"`, `"tan"`, `"cin"`, `"llpin"`, `"voter"`, `"vehicle"`, `"unknown"` |
| `indycheck_validate_many(inputs_json)` | JSON array of results (see below) |
| `indycheck_version()` | version string, e.g. `"0.2.0"` (heap-allocated, free it too) |
| `indycheck_free_string(ptr)` | releases a returned string; safe with `NULL` |

Validators return JSON in the core shape:

```json
{"valid": true, "code": "VALID", "reason_en": "...", "reason_hi": "...",
 "parsed": {"entity": "Unknown", "entity_code": "D"}}
```

`parsed` is omitted when there is nothing to report, exactly as in
the core crate.

`indycheck_validate_many` takes a JSON array of input strings, e.g.
`["ABCDE1234F", "9876543210"]`, and returns a JSON array of results
in the same order. Each input is detected and validated with the
matching validator. A null, non-UTF-8, or malformed-JSON input returns
a one-element array holding a single `INVALID_INPUT` result.

### Robustness

Validators never crash on bad input: a null pointer or non-UTF-8
input returns a JSON `INVALID_INPUT` result, and `indycheck_detect`
returns `"unknown"`.

## Example (C)

```c
#include <stdio.h>
#include "indycheck.h"

int main(void) {
    char *pan = indycheck_validate_pan("ABCDE1234F");
    char *bh  = indycheck_validate_vehicle("22BH1234AA");
    printf("%s\n%s\n", pan, bh);
    indycheck_free_string(pan);
    indycheck_free_string(bh);
    return 0;
}
```

```sh
gcc example.c -L ../../target/release -lindycheck_ffi \
    -Wl,-rpath,../../target/release -o example
```

## Tests

```sh
cargo test -p indycheck-ffi
```

The integration tests in `tests/ffi.rs` call the exported C functions
through the `rlib` half of the crate and check the JSON they return,
including Bharat-series vehicles, batch validation, malformed JSON,
and null inputs. The `.so` symbol table is checked with:

```sh
nm -D --defined-only target/release/libindycheck_ffi.so | grep indycheck_
```

It must list exactly the 18 symbols declared in `indycheck.h`.
