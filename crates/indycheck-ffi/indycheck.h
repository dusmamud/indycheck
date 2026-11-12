/* indycheck.h — C API for indycheck (offline Indian ID validator).
 * Generated with cbindgen from crates/indycheck-ffi. Do not edit by hand;
 * re-run: cbindgen --config cbindgen.toml --crate indycheck-ffi --output indycheck.h
 *
 * Ownership: every function returning `char *` returns a heap-allocated,
 * NUL-terminated UTF-8 string owned by the caller. Release it with
 * indycheck_free_string(). Never free() it directly, never free twice.
 * Validators return JSON: {"valid": bool, "code": "...", "reason_en": "...",
 * "reason_hi": "...", "parsed": {...}} ("parsed" omitted when absent).
 * indycheck_detect() returns a plain type string, not JSON.
 * indycheck_validate_many() takes a JSON array of strings and returns a
 * JSON array of validation results. */

#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdint.h>

/**
 * Validate a PAN. Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_pan(const char *input);

/**
 * Validate an Aadhaar number (12 digits, Verhoeff checksum). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_aadhaar(const char *input);

/**
 * Validate a GSTIN (15 chars). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_gstin(const char *input);

/**
 * Validate an Indian mobile number. Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_mobile(const char *input);

/**
 * Validate a vehicle registration number — state format (e.g. `DL01AB1234`) or Bharat (BH) series (e.g. `22BH1234AA`). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_vehicle(const char *input);

/**
 * Alias for `indycheck_validate_vehicle`. Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_vehicle_registration(const char *input);

/**
 * Validate an IFSC (11 chars). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_ifsc(const char *input);

/**
 * Validate a UPI ID (`name@handle`). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_upi(const char *input);

/**
 * Validate a 6-digit PIN code. Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_pincode(const char *input);

/**
 * Validate a TAN (format only, no checksum). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_tan(const char *input);

/**
 * Validate a CIN (21 chars, format only). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_cin(const char *input);

/**
 * Validate an LLPIN (3 letters + 4 digits). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_llpin(const char *input);

/**
 * Validate a Voter ID / EPIC (3 letters + 7 digits). Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_voter_id(const char *input);

/**
 * Alias for `indycheck_validate_voter_id`. Returns heap-allocated JSON — free with `indycheck_free_string`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_validate_epic(const char *input);

/**
 * Detect the type of an Indian ID string.
 *
 * Returns a heap-allocated plain string — `"pan"`, `"aadhaar"`,
 * `"gstin"`, `"ifsc"`, `"upi"`, `"mobile"`, `"pincode"`, `"tan"`,
 * `"cin"`, `"llpin"`, `"voter"`, `"vehicle"` or `"unknown"` — free it
 * with `indycheck_free_string`. A null or non-UTF-8 input returns
 * `"unknown"`.
 *
 * # Safety
 *
 * `input` must be null or point to a valid NUL-terminated C string
 * that stays alive for the duration of the call.
 */
char *indycheck_detect(const char *input);

/**
 * Validate many inputs in one call.
 *
 * `inputs_json` is a JSON array of strings, e.g.
 * `["ABCDE1234F", "9876543210"]`. Returns a heap-allocated JSON array
 * of `ValidationResult` objects in the same order — free it with
 * `indycheck_free_string`. A null / non-UTF-8 / malformed-JSON input
 * returns a one-element array holding a single `INVALID_INPUT`
 * result.
 *
 * # Safety
 *
 * `inputs_json` must be null or point to a valid NUL-terminated C
 * string that stays alive for the duration of the call.
 */
char *indycheck_validate_many(const char *inputs_json);

/**
 * Return the indycheck core version (e.g. `"0.2.0"`) as a
 * heap-allocated string — free it with `indycheck_free_string`.
 */
char *indycheck_version(void);

/**
 * Release a string previously returned by any `indycheck_*` function.
 *
 * Safe to call with a null pointer (does nothing). Never pass a
 * pointer that did not come from this library, and never free the
 * same pointer twice.
 *
 * # Safety
 *
 * `ptr` must be null or a pointer previously returned by this
 * library that has not been freed before.
 */
void indycheck_free_string(char *ptr);
