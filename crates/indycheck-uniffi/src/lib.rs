//! UniFFI bindings (Kotlin/Swift) for indycheck.
//!
//! Thin wrappers over the core crate — no validation logic lives here.
//! Every exported function calls the matching `indycheck` validator and
//! returns a [`ValidationResult`] record whose `parsed` field is the
//! core result's `parsed` object serialised as a JSON string (or `None`
//! when the core result has no parsed data). Keeping `parsed` as JSON
//! keeps the UniFFI interface identical across Kotlin and Swift, the
//! same approach the napi binding uses.
//!
//! The generated Kotlin and Swift sources are checked in under
//! `bindings/` — see the crate README for how to regenerate them.
//!
//! Honest limits (same as the core): this checks format and (where one
//! exists) checksum only. It does **not** verify that an ID really exists
//! or belongs to anyone.

use indycheck::{
    ValidationResult as CoreResult, detect as core_detect,
    validate_aadhaar as core_validate_aadhaar, validate_cin as core_validate_cin,
    validate_epic as core_validate_epic, validate_gstin as core_validate_gstin,
    validate_ifsc as core_validate_ifsc, validate_llpin as core_validate_llpin,
    validate_many as core_validate_many, validate_mobile as core_validate_mobile,
    validate_pan as core_validate_pan, validate_pincode as core_validate_pincode,
    validate_tan as core_validate_tan, validate_upi as core_validate_upi,
    validate_vehicle as core_validate_vehicle,
};

/// The single result type returned by every validator.
///
/// `valid` is true only when the input passed. `code` is `"VALID"` on
/// success, otherwise a stable machine-readable error code such as
/// `"INVALID_CHECKSUM"`. `reason_en` / `reason_hi` are human-readable
/// explanations in English and Hindi. `parsed` is the structured data
/// the validator extracted (e.g. a vehicle's state and series), as a
/// JSON string — `None` when there is nothing to parse (invalid input).
#[derive(Debug, Clone, PartialEq, uniffi::Record)]
pub struct ValidationResult {
    pub valid: bool,
    pub code: String,
    pub reason_en: String,
    pub reason_hi: String,
    pub parsed: Option<String>,
}

impl From<CoreResult> for ValidationResult {
    fn from(result: CoreResult) -> Self {
        Self {
            valid: result.valid,
            code: result.code,
            reason_en: result.reason_en,
            reason_hi: result.reason_hi,
            parsed: result
                .parsed
                .map(|value| serde_json::to_string(&value).unwrap_or_else(|_| "{}".into())),
        }
    }
}

#[uniffi::export]
pub fn validate_pan(input: String) -> ValidationResult {
    core_validate_pan(&input).into()
}

#[uniffi::export]
pub fn validate_aadhaar(input: String) -> ValidationResult {
    core_validate_aadhaar(&input).into()
}

#[uniffi::export]
pub fn validate_gstin(input: String) -> ValidationResult {
    core_validate_gstin(&input).into()
}

#[uniffi::export]
pub fn validate_ifsc(input: String) -> ValidationResult {
    core_validate_ifsc(&input).into()
}

#[uniffi::export]
pub fn validate_upi(input: String) -> ValidationResult {
    core_validate_upi(&input).into()
}

#[uniffi::export]
pub fn validate_mobile(input: String) -> ValidationResult {
    core_validate_mobile(&input).into()
}

#[uniffi::export]
pub fn validate_pincode(input: String) -> ValidationResult {
    core_validate_pincode(&input).into()
}

/// Validates a vehicle registration number, including Bharat (BH) series
/// numbers such as `22BH1234AA` (year 21+, `BH`, 4 digits, 2 letters).
#[uniffi::export]
pub fn validate_vehicle(input: String) -> ValidationResult {
    core_validate_vehicle(&input).into()
}

#[uniffi::export]
pub fn validate_tan(input: String) -> ValidationResult {
    core_validate_tan(&input).into()
}

#[uniffi::export]
pub fn validate_cin(input: String) -> ValidationResult {
    core_validate_cin(&input).into()
}

#[uniffi::export]
pub fn validate_llpin(input: String) -> ValidationResult {
    core_validate_llpin(&input).into()
}

#[uniffi::export]
pub fn validate_voter_id(input: String) -> ValidationResult {
    core_validate_epic(&input).into()
}

/// Detects the type of an Indian ID string. Returns one of `"pan"`,
/// `"aadhaar"`, `"gstin"`, `"ifsc"`, `"upi"`, `"mobile"`, `"pincode"`,
/// `"tan"`, `"cin"`, `"llpin"`, `"voter"`, `"vehicle"` or `"unknown"`.
#[uniffi::export]
pub fn detect(input: String) -> String {
    core_detect(&input)
}

/// Validates many inputs in one call: each input is detected and then
/// validated with the matching validator.
#[uniffi::export]
pub fn validate_many(inputs: Vec<String>) -> Vec<ValidationResult> {
    core_validate_many(&inputs)
        .into_iter()
        .map(ValidationResult::from)
        .collect()
}

uniffi::setup_scaffolding!();

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    /// The `parsed` JSON string, parsed back — `None` when the result
    /// carries no parsed data.
    fn parsed_json(result: &ValidationResult) -> Option<Value> {
        result
            .parsed
            .as_deref()
            .map(|s| serde_json::from_str(s).expect("parsed is valid JSON"))
    }

    #[test]
    fn pan_valid_and_invalid() {
        let ok = validate_pan("ABCDE1234F".to_string());
        assert!(ok.valid);
        assert_eq!(ok.code, "VALID");
        assert!(ok.reason_en.starts_with("PAN format is valid"));
        assert!(parsed_json(&ok).is_some());

        let bad = validate_pan("ABCDE12345".to_string());
        assert!(!bad.valid);
        assert_ne!(bad.code, "VALID");
        assert!(bad.parsed.is_none());
    }

    #[test]
    fn aadhaar_checksum() {
        assert!(validate_aadhaar("234567890124".to_string()).valid);
        let bad = validate_aadhaar("234567890125".to_string());
        assert!(!bad.valid);
        assert_eq!(bad.code, "INVALID_CHECKSUM");
    }

    #[test]
    fn gstin_checksum() {
        assert!(validate_gstin("18AAAPL1234C1ZD".to_string()).valid);
        assert!(!validate_gstin("18AAAPL1234C1ZE".to_string()).valid);
    }

    #[test]
    fn mobile_and_pincode() {
        assert!(validate_mobile("9876543210".to_string()).valid);
        assert!(validate_mobile("+91 98765 43210".to_string()).valid);
        assert!(!validate_mobile("5876543210".to_string()).valid);
        assert!(validate_pincode("781001".to_string()).valid);
        assert!(!validate_pincode("081001".to_string()).valid);
    }

    #[test]
    fn ifsc_and_upi() {
        assert!(validate_ifsc("SBIN0000123".to_string()).valid);
        assert!(!validate_ifsc("SBIN1000123".to_string()).valid);
        assert!(validate_upi("dus@okaxis".to_string()).valid);
        assert!(!validate_upi("name@unknownhandle".to_string()).valid);
    }

    #[test]
    fn vehicle_state_and_bharat_series() {
        let state = validate_vehicle("DL01AB1234".to_string());
        assert!(state.valid);
        assert_eq!(
            parsed_json(&state).unwrap()["series_type"],
            Value::String("state".to_string())
        );

        // Bharat series: YYBH####XX, year 21+ — added in v0.2.0.
        let bharat = validate_vehicle("22BH1234AA".to_string());
        assert!(bharat.valid);
        let parsed = parsed_json(&bharat).unwrap();
        assert_eq!(parsed["series_type"], Value::String("bharat".to_string()));
        assert_eq!(parsed["year"], Value::String("22".to_string()));

        // BH year before 2021 is not a Bharat number.
        assert!(!validate_vehicle("20BH1234AA".to_string()).valid);
    }

    #[test]
    fn tan_cin_llpin_voter() {
        assert!(validate_tan("AAAA12345B".to_string()).valid);
        assert!(validate_cin("L12345MH2020PLC123456".to_string()).valid);
        assert!(validate_llpin("AAA1234".to_string()).valid);
        assert!(validate_voter_id("ABC1234567".to_string()).valid);
    }

    #[test]
    fn detect_types() {
        assert_eq!(detect("ABCDE1234F".to_string()), "pan");
        assert_eq!(detect("234567890124".to_string()), "aadhaar");
        assert_eq!(detect("dus@okaxis".to_string()), "upi");
        assert_eq!(detect("781001".to_string()), "pincode");
        assert_eq!(detect("22BH1234AA".to_string()), "vehicle");
        assert_eq!(detect("garbage!!!".to_string()), "unknown");
    }

    #[test]
    fn validate_many_batch() {
        let results = validate_many(vec![
            "ABCDE1234F".to_string(),
            "234567890124".to_string(),
            "not-an-id".to_string(),
        ]);
        assert_eq!(results.len(), 3);
        assert!(results[0].valid);
        assert!(results[1].valid);
        assert!(!results[2].valid);
        assert_eq!(results[2].code, "UNKNOWN_TYPE");
    }

    #[test]
    fn record_roundtrips_through_json() {
        // The record's `parsed` field is what Kotlin/Swift receive, so
        // it must always be parseable JSON when present.
        let results = [
            validate_pan("ABCDE1234F".to_string()),
            validate_vehicle("22BH1234AA".to_string()),
            validate_ifsc("SBIN0000123".to_string()),
        ];
        for result in results {
            assert!(result.valid);
            let parsed = parsed_json(&result).expect("parsed JSON present");
            assert!(parsed.is_object());
        }
        // And invalid results carry no parsed data at all.
        assert!(validate_pan("ABCDE12345".to_string()).parsed.is_none());
    }
}
