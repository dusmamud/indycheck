//! Tests for the C FFI surface, exercised through the `rlib` half of
//! the crate (same symbols the `cdylib` exports — the `.so` symbol
//! table is checked separately with `nm`, see the crate README).

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use indycheck_ffi::{
    indycheck_detect, indycheck_free_string, indycheck_generate_aadhaar, indycheck_generate_gstin,
    indycheck_generate_mobile, indycheck_generate_pan, indycheck_generate_vehicle,
    indycheck_generate_vehicle_bharat, indycheck_validate_aadhaar, indycheck_validate_gstin,
    indycheck_validate_many, indycheck_validate_mobile, indycheck_validate_pan,
    indycheck_validate_pincode, indycheck_validate_vehicle, indycheck_version,
};

/// Call an FFI validator and return its JSON string (freed afterwards).
fn call(f: unsafe extern "C" fn(*const c_char) -> *mut c_char, input: &str) -> String {
    let c_input = CString::new(input).unwrap();
    let ptr = unsafe { f(c_input.as_ptr()) };
    assert!(!ptr.is_null(), "FFI function returned null for {input:?}");
    // SAFETY: `ptr` came from this library and has not been freed yet.
    let out = unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned();
    unsafe { indycheck_free_string(ptr) };
    out
}

fn call_null(f: unsafe extern "C" fn(*const c_char) -> *mut c_char) -> String {
    let ptr = unsafe { f(std::ptr::null()) };
    assert!(
        !ptr.is_null(),
        "FFI function returned null for a null input"
    );
    // SAFETY: `ptr` came from this library and has not been freed yet.
    let out = unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned();
    unsafe { indycheck_free_string(ptr) };
    out
}

#[test]
fn pan_returns_valid_json() {
    let json = call(indycheck_validate_pan, "ABCDE1234F");
    let v: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(v["valid"], true);
    assert_eq!(v["code"], "VALID");
    assert_eq!(v["parsed"]["entity_code"], "D");
    // "ABCDE1234F" has 4th character D, which is not in the published
    // entity list — entity is "Unknown" and the PAN is still valid.
    assert_eq!(v["parsed"]["entity"], "Unknown");
    assert!(!v["reason_hi"].as_str().unwrap().is_empty());
}

#[test]
fn pan_rejects_bad_input() {
    let json = call(indycheck_validate_pan, "ABCDE12345");
    let v: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(v["valid"], false);
    assert_eq!(v["code"], "INVALID_FORMAT");
    assert!(v.get("parsed").is_none());
}

#[test]
fn aadhaar_gstin_mobile_pincode_valid() {
    for (f, input) in [
        (
            indycheck_validate_aadhaar as unsafe extern "C" fn(*const c_char) -> *mut c_char,
            "234567890124",
        ),
        (indycheck_validate_gstin, "18AAAPL1234C1ZD"),
        (indycheck_validate_mobile, "9876543210"),
        (indycheck_validate_pincode, "781001"),
    ] {
        let v: serde_json::Value = serde_json::from_str(&call(f, input)).unwrap();
        assert_eq!(v["valid"], true, "expected valid for {input}");
        assert_eq!(v["code"], "VALID");
    }
}

#[test]
fn vehicle_state_and_bharat_series() {
    let state: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_vehicle, "DL01AB1234")).unwrap();
    assert_eq!(state["valid"], true);
    assert_eq!(state["parsed"]["series_type"], "state");

    // Bharat (BH) series: YYBH####XX, year 21+.
    let bharat: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_vehicle, "22BH1234AA")).unwrap();
    assert_eq!(bharat["valid"], true);
    assert_eq!(bharat["code"], "VALID");
    assert_eq!(bharat["parsed"]["series_type"], "bharat");
    assert_eq!(bharat["parsed"]["year"], "22");
    assert_eq!(bharat["parsed"]["suffix"], "AA");

    // BH year before 2021 must fail.
    let early: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_vehicle, "20BH1234AA")).unwrap();
    assert_eq!(early["valid"], false);
}

#[test]
fn detect_returns_plain_type_string() {
    assert_eq!(call(indycheck_detect, "ABCDE1234F"), "pan");
    assert_eq!(call(indycheck_detect, "9876543210"), "mobile");
    assert_eq!(call(indycheck_detect, "22BH1234AA"), "vehicle");
    assert_eq!(call(indycheck_detect, "not an id at all"), "unknown");
}

#[test]
fn validate_many_returns_json_array_in_order() {
    let json = call(
        indycheck_validate_many,
        r#"["ABCDE1234F", "9876543210", "nope"]"#,
    );
    let v: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert!(v.is_array());
    assert_eq!(v.as_array().unwrap().len(), 3);
    assert_eq!(v[0]["valid"], true);
    assert_eq!(v[1]["valid"], true);
    assert_eq!(v[2]["valid"], false);
}

#[test]
fn validate_many_malformed_json_is_one_invalid_input_result() {
    let json = call(indycheck_validate_many, "not json at all");
    let v: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert!(v.is_array());
    assert_eq!(v.as_array().unwrap().len(), 1);
    assert_eq!(v[0]["valid"], false);
    assert_eq!(v[0]["code"], "INVALID_INPUT");
}

#[test]
fn null_input_never_crashes() {
    let json = call_null(indycheck_validate_pan);
    let v: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(v["valid"], false);
    assert_eq!(v["code"], "INVALID_INPUT");
    assert_eq!(call_null(indycheck_detect), "unknown");
    let many = call_null(indycheck_validate_many);
    let v: serde_json::Value = serde_json::from_str(&many).unwrap();
    assert_eq!(v[0]["code"], "INVALID_INPUT");
}

#[test]
fn free_string_accepts_null_and_version_is_semver() {
    unsafe { indycheck_free_string(std::ptr::null_mut()) };
    let ptr = indycheck_version();
    assert!(!ptr.is_null());
    // SAFETY: `ptr` came from this library and has not been freed yet.
    let version = unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned();
    unsafe { indycheck_free_string(ptr) };
    assert_eq!(version, env!("CARGO_PKG_VERSION"));
    assert!(
        version.split('.').count() == 3,
        "version {version} is not semver"
    );
}

/// Call a no-argument generator and return its string (freed afterwards).
fn generate(f: unsafe extern "C" fn() -> *mut c_char) -> String {
    let ptr = unsafe { f() };
    assert!(!ptr.is_null(), "FFI generator returned null");
    // SAFETY: `ptr` came from this library and has not been freed yet.
    let out = unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned();
    unsafe { indycheck_free_string(ptr) };
    out
}

/// Call a generator that takes one string argument (null allowed).
fn generate_with(
    f: unsafe extern "C" fn(*const c_char) -> *mut c_char,
    arg: Option<&str>,
) -> String {
    let c_arg = arg.map(|a| CString::new(a).unwrap());
    let ptr = unsafe { f(c_arg.as_ref().map_or(std::ptr::null(), |c| c.as_ptr())) };
    assert!(!ptr.is_null(), "FFI generator returned null");
    // SAFETY: `ptr` came from this library and has not been freed yet.
    let out = unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned();
    unsafe { indycheck_free_string(ptr) };
    out
}

#[test]
fn generators_produce_valid_test_data() {
    // Every generated value must validate cleanly through the same
    // FFI surface the other languages use.
    let pan = generate_with(indycheck_generate_pan, Some("P"));
    assert_eq!(pan.chars().nth(3), Some('P'));
    let v: serde_json::Value = serde_json::from_str(&call(indycheck_validate_pan, &pan)).unwrap();
    assert_eq!(v["valid"], true);

    let aadhaar = generate(indycheck_generate_aadhaar);
    let v: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_aadhaar, &aadhaar)).unwrap();
    assert_eq!(v["valid"], true);

    let gstin = generate_with(indycheck_generate_gstin, Some("27"));
    assert!(gstin.starts_with("27"));
    let v: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_gstin, &gstin)).unwrap();
    assert_eq!(v["valid"], true);

    let mobile = generate(indycheck_generate_mobile);
    let v: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_mobile, &mobile)).unwrap();
    assert_eq!(v["valid"], true);

    let vehicle = generate(indycheck_generate_vehicle);
    let v: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_vehicle, &vehicle)).unwrap();
    assert_eq!(v["valid"], true);

    let bharat = generate(indycheck_generate_vehicle_bharat);
    assert!(bharat.contains("BH"));
    let v: serde_json::Value =
        serde_json::from_str(&call(indycheck_validate_vehicle, &bharat)).unwrap();
    assert_eq!(v["valid"], true);
    assert_eq!(v["parsed"]["series_type"], "bharat");
}

#[test]
fn generators_fall_back_on_null_or_unknown_arguments() {
    // Null entity / state code must not crash and must use the defaults.
    let pan = generate_with(indycheck_generate_pan, None);
    assert_eq!(pan.chars().nth(3), Some('P'));
    let gstin = generate_with(indycheck_generate_gstin, None);
    assert!(gstin.starts_with("18"));
    let gstin = generate_with(indycheck_generate_gstin, Some("99"));
    assert!(gstin.starts_with("18"));
}
