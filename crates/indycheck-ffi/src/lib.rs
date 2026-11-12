//! C FFI bindings for indycheck — the C API behind the Go binding.
//!
//! Thin wrapper over the core crate `indycheck`: no validation logic
//! lives here, every exported function just calls the matching core
//! validator and serialises its [`ValidationResult`] to JSON.
//!
//! # Ownership rules (C callers must follow these)
//!
//! * Every function returning `*mut c_char` returns a heap-allocated,
//!   NUL-terminated UTF-8 string owned by the caller. Release it with
//!   [`indycheck_free_string`] — never `free()` it directly and never
//!   free the same pointer twice.
//! * Validators return JSON in the core shape:
//!   `{"valid": bool, "code": "...", "reason_en": "...",
//!   "reason_hi": "...", "parsed": {...}}` (`parsed` is omitted when
//!   there is nothing to report, exactly as in the core crate).
//! * [`indycheck_detect`] returns a plain (non-JSON) type string:
//!   `"pan" | "aadhaar" | "gstin" | "ifsc" | "upi" | "mobile" |
//!   "pincode" | "tan" | "cin" | "llpin" | "voter" | "vehicle" |
//!   "unknown"`.
//! * [`indycheck_validate_many`] takes a JSON array of input strings,
//!   e.g. `["ABCDE1234F", "9876543210"]`, and returns a JSON array of
//!   `ValidationResult` objects in the same order. A malformed JSON
//!   input returns a one-element array holding a single
//!   `INVALID_INPUT` result instead of failing.
//! * A null input pointer, or input that is not valid UTF-8, is never a
//!   crash: validators return a JSON `INVALID_INPUT` result and
//!   `indycheck_detect` returns `"unknown"`.
//! * [`indycheck_version`] returns the core crate version as a
//!   heap-allocated string; free it with `indycheck_free_string` like
//!   any other returned string.
//!
//! The C header is `indycheck.h` next to this crate's `Cargo.toml`,
//! generated with `cbindgen` (see `cbindgen.toml`).

// Re-export the core API for Rust consumers of the `rlib` half of
// this crate; the C API below is the part other languages use.
pub use indycheck::*;

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

/// Serialise a result to JSON. This cannot fail for a `ValidationResult`;
/// the fallback keeps the function total even if serialisation ever did.
fn result_json(result: &ValidationResult) -> String {
    serde_json::to_string(result).unwrap_or_else(|_| {
        "{\"valid\":false,\"code\":\"INVALID_INPUT\",\"reason_en\":\"Could not serialise the validation result\",\"reason_hi\":\"Validation result ko serialise nahi kiya ja saka\"}"
            .to_string()
    })
}

/// Turn a heap-allocated Rust `String` into a C string the caller owns.
/// Returns null only on allocation failure inside `CString::new`
/// (impossible here — validation JSON never contains a NUL byte — but
/// callers must still treat a null return as an error, not dereference it).
fn into_c_string(s: String) -> *mut c_char {
    match CString::new(s) {
        Ok(cstring) => cstring.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Read a `*const c_char` argument as `&str`.
///
/// Returns `None` for a null pointer or non-UTF-8 input; callers turn
/// that into an `INVALID_INPUT` result (or `"unknown"` for detect).
/// The returned slice borrows the caller's buffer and must not outlive
/// the call.
///
/// # Safety
///
/// `ptr` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
unsafe fn input_str<'a>(ptr: *const c_char) -> Option<&'a str> {
    if ptr.is_null() {
        return None;
    }
    // SAFETY: null was checked above; the caller guarantees a valid
    // NUL-terminated C string for the duration of the call.
    unsafe { CStr::from_ptr(ptr) }.to_str().ok()
}

/// Run one core validator over a C string argument and return its JSON.
///
/// # Safety
///
/// `ptr` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call; `f` must be one of
/// the core validators, which never panic on any input.
unsafe fn validate_one(ptr: *const c_char, f: fn(&str) -> ValidationResult) -> *mut c_char {
    // SAFETY: `input_str` upholds the C-string contract; the function
    // pointer is always one of the core validators below.
    let result = match unsafe { input_str(ptr) } {
        Some(input) => f(input),
        None => ValidationResult::err(
            "INVALID_INPUT",
            "Input must be a valid UTF-8 string",
            "Input ek valid UTF-8 string hona chahiye",
        ),
    };
    into_c_string(result_json(&result))
}

/// Validate a PAN. Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_pan(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_pan) }
}

/// Validate an Aadhaar number (12 digits, Verhoeff checksum). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_aadhaar(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_aadhaar) }
}

/// Validate a GSTIN (15 chars). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_gstin(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_gstin) }
}

/// Validate an Indian mobile number. Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_mobile(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_mobile) }
}

/// Validate a vehicle registration number — state format (e.g. `DL01AB1234`) or Bharat (BH) series (e.g. `22BH1234AA`). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_vehicle(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_vehicle) }
}

/// Alias for `indycheck_validate_vehicle`. Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_vehicle_registration(
    input: *const c_char,
) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_vehicle_registration) }
}

/// Validate an IFSC (11 chars). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_ifsc(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_ifsc) }
}

/// Validate a UPI ID (`name@handle`). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_upi(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_upi) }
}

/// Validate a 6-digit PIN code. Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_pincode(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_pincode) }
}

/// Validate a TAN (format only, no checksum). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_tan(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_tan) }
}

/// Validate a CIN (21 chars, format only). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_cin(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_cin) }
}

/// Validate an LLPIN (3 letters + 4 digits). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_llpin(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_llpin) }
}

/// Validate a Voter ID / EPIC (3 letters + 7 digits). Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_voter_id(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_voter_id) }
}

/// Alias for `indycheck_validate_voter_id`. Returns heap-allocated JSON — free with `indycheck_free_string`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_epic(input: *const c_char) -> *mut c_char {
    // SAFETY: delegates to `validate_one`, which upholds the
    // C-string contract for the core validator.
    unsafe { validate_one(input, indycheck::validate_epic) }
}

/// Detect the type of an Indian ID string.
///
/// Returns a heap-allocated plain string — `"pan"`, `"aadhaar"`,
/// `"gstin"`, `"ifsc"`, `"upi"`, `"mobile"`, `"pincode"`, `"tan"`,
/// `"cin"`, `"llpin"`, `"voter"`, `"vehicle"` or `"unknown"` — free it
/// with `indycheck_free_string`. A null or non-UTF-8 input returns
/// `"unknown"`.
///
/// # Safety
///
/// `input` must be null or point to a valid NUL-terminated C string
/// that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_detect(input: *const c_char) -> *mut c_char {
    // SAFETY: `input_str` upholds the C-string contract.
    let detected = match unsafe { input_str(input) } {
        Some(text) => indycheck::detect(text),
        None => "unknown".to_string(),
    };
    into_c_string(detected)
}

/// Validate many inputs in one call.
///
/// `inputs_json` is a JSON array of strings, e.g.
/// `["ABCDE1234F", "9876543210"]`. Returns a heap-allocated JSON array
/// of `ValidationResult` objects in the same order — free it with
/// `indycheck_free_string`. A null / non-UTF-8 / malformed-JSON input
/// returns a one-element array holding a single `INVALID_INPUT`
/// result.
///
/// # Safety
///
/// `inputs_json` must be null or point to a valid NUL-terminated C
/// string that stays alive for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_validate_many(inputs_json: *const c_char) -> *mut c_char {
    // SAFETY: `input_str` upholds the C-string contract.
    let results: Vec<ValidationResult> = match unsafe { input_str(inputs_json) } {
        Some(json) => match serde_json::from_str::<Vec<String>>(json) {
            Ok(inputs) => indycheck::validate_many(&inputs),
            Err(_) => vec![ValidationResult::err(
                "INVALID_INPUT",
                "Input must be a JSON array of strings",
                "Input strings ka JSON array hona chahiye",
            )],
        },
        None => vec![ValidationResult::err(
            "INVALID_INPUT",
            "Input must be a valid UTF-8 string",
            "Input ek valid UTF-8 string hona chahiye",
        )],
    };
    into_c_string(serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string()))
}

/// Return the indycheck core version (e.g. `"0.2.0"`) as a
/// heap-allocated string — free it with `indycheck_free_string`.
#[unsafe(no_mangle)]
pub extern "C" fn indycheck_version() -> *mut c_char {
    into_c_string(env!("CARGO_PKG_VERSION").to_string())
}

/// Release a string previously returned by any `indycheck_*` function.
///
/// Safe to call with a null pointer (does nothing). Never pass a
/// pointer that did not come from this library, and never free the
/// same pointer twice.
///
/// # Safety
///
/// `ptr` must be null or a pointer previously returned by this
/// library that has not been freed before.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn indycheck_free_string(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    // SAFETY: the caller guarantees `ptr` came from this library and
    // has not been freed before; reconstructing the `CString` drops it.
    let _ = unsafe { CString::from_raw(ptr) };
}
