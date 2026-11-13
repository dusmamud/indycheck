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
- A C compiler (`gcc`) for cgo — needed to link the vendored static
  library. **No Rust toolchain is needed** to use this package: the
  prebuilt `libindycheck_ffi.a` for your platform is vendored in
  `lib/` (see Releases below). A Rust toolchain is only needed if
  you change the Rust core and want to rebuild the vendored
  libraries (see "Rebuilding the vendored libraries").

## Build

From this directory:

```sh
go test ./...
go build ./...
```

The `#cgo` directives in `indycheck.go` link the vendored static
archive for the build platform (`lib/<platform>/libindycheck_ffi.a`,
header in `lib/indycheck.h`). On musl Linux build with `-tags musl`
to select the musl archive (`go build -tags musl`); without the tag
the glibc archive is used.

## Releases

**0.2.5 is released** (tag `packages/go/v0.2.5`). It contains the
indycheck core **0.2.4** — the Go module is versioned independently
of the Rust core, and v0.2.5 is the first published Go version
(the v0.2.4 tag's module path was wrong, so the Go module proxy
cached a broken entry for it; v0.2.5 is the corrected first release).

```sh
go get github.com/dusmamud/indycheck/packages/go@v0.2.5
```

The Go module proxy fetches the tagged module once the tag exists
(`go list -m -versions github.com/dusmamud/indycheck/packages/go` lists the
available versions). The tag is `packages/go/v0.2.4`, not
`indycheck-v0.2.4` — Go versions a module in a subdirectory by
prefixing the tag with the subdirectory, and the `v` is required.
`indycheck-v0.2.4` is the Rust / npm / PyPI release tag for the same
version.

### How a release is cut

1. **Vendor the prebuilt libraries.** The C library is built in CI
   from the FFI crate by `.github/workflows/c-release.yml` when the
   `indycheck-vX.Y.Z` tag lands, and the archives are attached to
   the GitHub Release. The static archives from those archives are
   vendored into this package, one per platform, so `go get` works
   with no Rust toolchain on the user's machine:

   ```text
   packages/go/lib/
     indycheck.h                        # copy of crates/indycheck-ffi/indycheck.h (same on all platforms)
     linux-x64-gnu/libindycheck_ffi.a
     linux-x64-musl/libindycheck_ffi.a
     darwin-arm64/libindycheck_ffi.a
     darwin-x64/libindycheck_ffi.a
     win32-x64-gnu/libindycheck_ffi.a   # GNU-target build — see the Windows note below
   ```

   `indycheck.go` links the vendored archive for the build platform:

   ```go
   // #cgo CFLAGS: -I${SRCDIR}/lib
   // #cgo linux,!musl LDFLAGS: -L${SRCDIR}/lib/linux-x64-gnu -lindycheck_ffi -ldl -lpthread -lm
   // #cgo linux,musl LDFLAGS: -L${SRCDIR}/lib/linux-x64-musl -lindycheck_ffi -ldl -lpthread -lm
   // #cgo darwin,arm64 LDFLAGS: -L${SRCDIR}/lib/darwin-arm64 -lindycheck_ffi
   // #cgo darwin,amd64 LDFLAGS: -L${SRCDIR}/lib/darwin-x64 -lindycheck_ffi
   // #cgo windows LDFLAGS: -L${SRCDIR}/lib/win32-x64-gnu -lindycheck_ffi -lws2_32 -luserenv -lbcrypt -lntdll -lsynchronization
   ```

   Two honest caveats:

   - **Windows:** the vendored Windows archive must be the
     **GNU-target** build (`win32-x64-gnu` archive). MinGW gcc —
     the C compiler Go + cgo uses on Windows — cannot link the
     MSVC `.lib` from the `win32-x64-msvc` archive (proven in
     `.github/workflows/go.yml`, which builds the GNU target for
     exactly this reason). A statically linked Go binary then
     needs no DLL at run time.
   - **musl:** Go build constraints cannot tell glibc from musl,
     so the musl archive is selected with an explicit build tag:
     `go build -tags musl` / `go test -tags musl`. Without the tag
     the glibc archive is used.

   The `.a` files are committed binaries (like any vendored
   dependency) — they are what make the tagged module
   self-contained. They are rebuilt from the same tag commit by
   CI, never hand-copied from a local machine.

2. **Tag it, after the vendored libraries are on main.** Dus
   creates the tag pointing at the commit that includes the
   vendored libraries:

   ```sh
   git checkout main
   git pull
   git tag packages/go/v0.2.5
   git push origin packages/go/v0.2.5
   ```

   Do not create this tag before the vendored libraries land: the
   tag must point at a commit that already includes them.

### Rebuilding the vendored libraries

If you change the Rust core and want to rebuild the vendored
libraries from source, build the FFI crate and replace the matching
archive (see `indycheck.go` for the layout). From the repo root:

```sh
cargo build -p indycheck-ffi --release
```

That produces `target/release/libindycheck_ffi.a` (staticlib) and
`target/release/libindycheck_ffi.so`. Copy the static archive into
`packages/go/lib/<platform>/`. On Windows the same flow needs MinGW
gcc (see `.github/workflows/go.yml`) and the GNU-target C library
build (`cargo build -p indycheck-ffi --release --target
x86_64-pc-windows-gnu`).

## Usage

```go
import "github.com/dusmamud/indycheck/packages/go"

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
