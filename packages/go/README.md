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

## Releases

**Status: no released version yet.** There is no `packages/go/v*`
tag, so `go get` with a version does not work yet. Until the first
tag exists, the only way to use this package is the source build
above (or `go get github.com/dusmamud/indycheck-go@main`, which
still needs the `cargo build` step first).

### How a release is cut (0.2.3)

1. **Tag it, after the 0.2.3 PR merges.** Dus creates the tag
   pointing at the merge commit (the tag must point at a commit that
   already includes the vendored libraries in step 3):

   ```sh
   git checkout main
   git pull
   git tag packages/go/v0.2.3
   git push origin packages/go/v0.2.3
   ```

   The tag is `packages/go/v0.2.3`, not `indycheck-v0.2.3` — Go
   versions a module in a subdirectory by prefixing the tag with
   the subdirectory, and the `v` is required. `indycheck-v0.2.3`
   is the Rust / npm / PyPI release tag for the same version.
   Do not create this tag before the merge: the vendored libraries
   below must be in the tagged commit.

2. **Install it:**

   ```sh
   go get github.com/dusmamud/indycheck-go@v0.2.3
   ```

   The Go module proxy fetches the tagged module once the tag
   exists (`go list -m -versions github.com/dusmamud/indycheck-go`
   lists the available versions).

3. **Vendored prebuilt libraries (happens at release time, not
   yet in the repo).** The C library is built in CI from the FFI
   crate by `.github/workflows/c-release.yml` when the
   `indycheck-v0.2.3` tag lands, and the archives are attached to
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

   `indycheck.go` then gains `#cgo` directives that pick the
   vendored archive for the build platform, replacing the
   `../../target/release` lookup for tagged builds (planned form —
   the exact flags are verified in CI before the tag lands, because
   a Rust static library also needs the system libraries the Rust
   standard library uses, e.g. `-ldl -lpthread -lm` on Linux and
   the Windows system libraries already listed in `indycheck.go`):

   ```go
   // #cgo CFLAGS: -I${SRCDIR}/lib
   // #cgo linux,!musl LDFLAGS: -L${SRCDIR}/lib/linux-x64-gnu -lindycheck_ffi -ldl -lpthread -lm
   // #cgo linux,musl LDFLAGS: -L${SRCDIR}/lib/linux-x64-musl -lindycheck_ffi -ldl -lpthread -lm
   // #cgo darwin,arm64 LDFLAGS: -L${SRCDIR}/lib/darwin-arm64 -lindycheck_ffi
   // #cgo darwin,amd64 LDFLAGS: -L${SRCDIR}/lib/darwin-x64 -lindycheck_ffi
   // #cgo windows LDFLAGS: -L${SRCDIR}/lib/win32-x64-gnu -lindycheck_ffi -lws2_32 -luserenv -lbcrypt -lntdll
   ```

   Two honest caveats on that plan:

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

### Building from source instead

If you are working from a checkout (or on a platform with no
vendored archive), ignore the `lib/` layout above and use the
Build section at the top of this README: Go 1.22+, a Rust
toolchain and a C compiler, `cargo build -p indycheck-ffi
--release`, then `go test ./...` / `go build ./...`. The `#cgo`
directives in `indycheck.go` point at
`../../crates/indycheck-ffi/indycheck.h` and
`../../target/release/libindycheck_ffi.so` for that flow, with an
`rpath` so test and example binaries find the library at run
time. On Windows the same flow needs MinGW gcc (see
`.github/workflows/go.yml`) and the GNU-target C library build.

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
