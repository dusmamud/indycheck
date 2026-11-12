# indycheck-go — Go binding for indycheck

Go binding for [indycheck](https://github.com/dusmamud/indycheck), the
offline Indian ID validator (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile,
PIN code, TAN, CIN, LLPIN, Voter ID / EPIC, vehicle registration —
including Bharat (BH) series numbers such as `22BH1234AA`).

It is a thin [cgo](https://pkg.go.dev/cmd/cgo) wrapper over the C API
in `crates/indycheck-ffi`, which itself is a thin wrapper over the Rust
core in `crates/indycheck`. **No validation logic lives in this
package** — every function calls the matching C function and decodes
the JSON result it returns, so Go returns the same answer as Rust for
the same input.

## Prerequisites

- Go 1.22 or later
- A Rust toolchain (`cargo`) and a C compiler (`gcc`) — needed once,
  to build the shared library this package links against

## Build

From the repo root, build the Rust shared library first:

```sh
cargo build -p indycheck-ffi --release
```

That produces `target/release/libindycheck_ffi.so`. Then, from this
directory:

```sh
go test ./...
go build ./...
```

The `#cgo` directives in `indycheck.go` point at
`../../crates/indycheck-ffi/indycheck.h` and
`../../target/release/libindycheck_ffi.so` (with an `rpath` so test
and example binaries find the library at run time). If you move the
`.so` elsewhere, set `CGO_LDFLAGS` / `LD_LIBRARY_PATH` accordingly —
or vendor the header + library next to your own build.

> The `.so` is a build artefact, not a source: it is never committed
> to the repo. Anyone building this package must run the `cargo build`
> step above first.

## Usage

```go
import "github.com/dusmamud/indycheck-go"

r, err := indycheck.ValidatePan("ABCDE1234F")
if err != nil {
    // transport / JSON error — not a validation failure
}
if r.Valid {
    fmt.Println(r.Code, r.Parsed["entity"], r.Parsed["entity_code"])
} else {
    fmt.Println(r.Code, r.ReasonEN, r.ReasonHI)
}

// Bharat (BH) series vehicle number
v, _ := indycheck.ValidateVehicle("22BH1234AA")
fmt.Println(v.Valid, v.Parsed["series_type"], v.Parsed["year"], v.Parsed["suffix"])

// Detect the type first, then validate a batch in one call
t, _ := indycheck.Detect("9876543210") // "mobile"
batch, _ := indycheck.ValidateMany([]string{"ABCDE1234F", "9876543210", "nope"})
```

## API

Every validator returns `(Result, error)`. `error` is only for
transport/JSON failures; a failed validation is a normal `Result`
with `Valid == false` and a stable `Code` (`INVALID_FORMAT`,
`INVALID_LENGTH`, `EMPTY`, …).

```go
type Result struct {
    Valid    bool           `json:"valid"`
    Code     string         `json:"code"`
    ReasonEN string         `json:"reason_en"`
    ReasonHI string         `json:"reason_hi"`
    Parsed   map[string]any `json:"parsed,omitempty"` // extracted fields on success, nil otherwise
}
```

| Function | Validates |
|---|---|
| `ValidatePan` | PAN, e.g. `ABCDE1234F` |
| `ValidateAadhaar` | 12-digit Aadhaar (Verhoeff checksum) |
| `ValidateGstin` | 15-character GSTIN |
| `ValidateMobile` | Indian mobile (`+91` / `91` / `0` prefix, spaces/hyphens OK) |
| `ValidateVehicle` / `ValidateVehicleRegistration` | State format (`DL01AB1234`) or Bharat series (`22BH1234AA`) |
| `ValidateIfsc` | IFSC (11 characters) |
| `ValidateUpi` | UPI ID (`name@handle`) |
| `ValidatePincode` | 6-digit PIN code |
| `ValidateTan` | TAN (format only) |
| `ValidateCin` | CIN (format only) |
| `ValidateLlpin` | LLPIN |
| `ValidateVoterID` / `ValidateEpic` | Voter ID / EPIC |
| `Detect` | Returns the type string (`"pan"`, `"mobile"`, `"vehicle"`, …, `"unknown"`) |
| `ValidateMany([]string)` | Batch: detects then validates each input, results in input order |
| `Version()` | Core version string, e.g. `"0.2.0"` |

Honest limits (same as the core): this checks format and, where one
exists, checksum only. It does **not** verify that an ID really exists
or belongs to anyone — that needs UIDAI / NSDL / GSTN / RBI, which
this library never contacts.
