// Package indycheck is the Go binding for indycheck, the offline Indian
// ID validator (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN code, TAN,
// CIN, LLPIN, Voter ID / EPIC, vehicle registration — including Bharat
// (BH) series numbers such as 22BH1234AA).
//
// It is a thin cgo wrapper over the C API in crates/indycheck-ffi,
// which itself is a thin wrapper over the Rust core in
// crates/indycheck. No validation logic lives in this package: every
// function calls the matching C function and decodes the JSON result
// it returns.
//
// Build prerequisite: the Rust shared library must exist first:
//
//	cargo build -p indycheck-ffi --release
//
// That produces target/release/libindycheck_ffi.so at the repo root,
// which this package links against. See README.md in this directory.
package indycheck

/*
#cgo CFLAGS: -I${SRCDIR}/../../crates/indycheck-ffi
#cgo LDFLAGS: -L${SRCDIR}/../../target/release -lindycheck_ffi -Wl,-rpath,${SRCDIR}/../../target/release
// On Windows the Rust static library is linked by MinGW gcc, which —
// unlike MSVC's link.exe — does not implicitly link the Windows
// system libraries the Rust standard library references. Link them
// explicitly: ws2_32 (Winsock: freeaddrinfo, WSASend, WSARecv, ...),
// userenv and bcrypt (std's home-dir / randomness helpers).
// gcc already links kernel32/advapi32/user32 by default.
#cgo windows LDFLAGS: -lws2_32 -luserenv -lbcrypt
#include <stdlib.h>
#include "indycheck.h"
*/
import "C"

import (
	"encoding/json"
	"errors"
	"unsafe"
)

// Result is the single result type returned by every validator, matching
// the core Rust ValidationResult and its JSON shape. Parsed holds the
// extracted fields on success (e.g. Pan: entity/entity_code, Vehicle:
// series_type/state_code/district/series/number or series_type/year/
// series/number/suffix for Bharat numbers) and is nil otherwise — the
// JSON omits "parsed" when there is nothing to report.
type Result struct {
	Valid    bool           `json:"valid"`
	Code     string         `json:"code"`
	ReasonEN string         `json:"reason_en"`
	ReasonHI string         `json:"reason_hi"`
	Parsed   map[string]any `json:"parsed,omitempty"`
}

// cString converts a Go string to a C string freed by the caller.
func cString(s string) *C.char { return C.CString(s) }

// goStringAndFree copies a heap-allocated C string returned by the
// library into a Go string and releases it with indycheck_free_string.
func goStringAndFree(ptr *C.char) (string, error) {
	if ptr == nil {
		return "", errors.New("indycheck: library returned NULL")
	}
	defer C.indycheck_free_string(ptr)
	return C.GoString(ptr), nil
}

// callValidator runs one C validator over input and decodes its JSON.
func callValidator(fn func(*C.char) *C.char, input string) (Result, error) {
	cInput := cString(input)
	defer C.free(unsafe.Pointer(cInput))
	jsonStr, err := goStringAndFree(fn(cInput))
	if err != nil {
		return Result{}, err
	}
	var result Result
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return Result{}, err
	}
	return result, nil
}

// ValidatePan validates a PAN (e.g. ABCDE1234F).
func ValidatePan(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_pan(c) }, input)
}

// ValidateAadhaar validates a 12-digit Aadhaar number (Verhoeff checksum).
func ValidateAadhaar(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_aadhaar(c) }, input)
}

// ValidateGstin validates a 15-character GSTIN.
func ValidateGstin(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_gstin(c) }, input)
}

// ValidateMobile validates an Indian mobile number (10 digits, first
// digit 6-9; +91 / 91 / 0 prefixes, spaces and hyphens accepted).
func ValidateMobile(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_mobile(c) }, input)
}

// ValidateVehicle validates a vehicle registration number — state
// format (e.g. DL01AB1234) or Bharat (BH) series (e.g. 22BH1234AA).
// On success Parsed["series_type"] is "state" or "bharat".
func ValidateVehicle(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_vehicle(c) }, input)
}

// ValidateVehicleRegistration is an alias for ValidateVehicle.
func ValidateVehicleRegistration(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_vehicle_registration(c) }, input)
}

// ValidateIfsc validates an IFSC (11 characters).
func ValidateIfsc(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_ifsc(c) }, input)
}

// ValidateUpi validates a UPI ID (name@handle).
func ValidateUpi(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_upi(c) }, input)
}

// ValidatePincode validates a 6-digit PIN code.
func ValidatePincode(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_pincode(c) }, input)
}

// ValidateTan validates a TAN (format only, no checksum).
func ValidateTan(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_tan(c) }, input)
}

// ValidateCin validates a CIN (21 characters, format only).
func ValidateCin(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_cin(c) }, input)
}

// ValidateLlpin validates an LLPIN (3 letters + 4 digits).
func ValidateLlpin(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_llpin(c) }, input)
}

// ValidateVoterID validates a Voter ID / EPIC (3 letters + 7 digits).
func ValidateVoterID(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_voter_id(c) }, input)
}

// ValidateEpic is an alias for ValidateVoterID.
func ValidateEpic(input string) (Result, error) {
	return callValidator(func(c *C.char) *C.char { return C.indycheck_validate_epic(c) }, input)
}

// Detect returns the type of an Indian ID string: "pan", "aadhaar",
// "gstin", "ifsc", "upi", "mobile", "pincode", "tan", "cin", "llpin",
// "voter", "vehicle" or "unknown".
func Detect(input string) (string, error) {
	cInput := cString(input)
	defer C.free(unsafe.Pointer(cInput))
	return goStringAndFree(C.indycheck_detect(cInput))
}

// ValidateMany validates many inputs in one call: each input is
// detected and then validated with the matching validator. Results
// are in the same order as the inputs.
func ValidateMany(inputs []string) ([]Result, error) {
	inputsJSON, err := json.Marshal(inputs)
	if err != nil {
		return nil, err
	}
	cInputs := cString(string(inputsJSON))
	defer C.free(unsafe.Pointer(cInputs))
	jsonStr, err := goStringAndFree(C.indycheck_validate_many(cInputs))
	if err != nil {
		return nil, err
	}
	var results []Result
	if err := json.Unmarshal([]byte(jsonStr), &results); err != nil {
		return nil, err
	}
	return results, nil
}

// Version returns the indycheck core version (e.g. "0.2.0").
func Version() (string, error) {
	return goStringAndFree(C.indycheck_version())
}
