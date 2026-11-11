//! Node.js bindings for indycheck — thin napi-rs wrappers over the Rust core.
//!
//! Phase 2 scaffold (v0.1): the wrappers below return JSON strings and call
//! the core crate for all logic. The npm packaging (package.json, napi
//! build config) is not finished yet — see README.md in this crate.

use indycheck::{
    detect as core_detect, format_gstin as core_format_gstin, format_mobile as core_format_mobile,
    format_pan as core_format_pan, generate_aadhaar as core_generate_aadhaar,
    generate_gstin as core_generate_gstin, generate_mobile as core_generate_mobile,
    generate_pan as core_generate_pan, mask_aadhaar as core_mask_aadhaar,
    mask_mobile as core_mask_mobile, mask_pan as core_mask_pan,
    validate_aadhaar as core_validate_aadhaar, validate_cin as core_validate_cin,
    validate_gstin as core_validate_gstin, validate_ifsc as core_validate_ifsc,
    validate_llpin as core_validate_llpin, validate_many as core_validate_many,
    validate_mobile as core_validate_mobile, validate_pan as core_validate_pan,
    validate_pincode as core_validate_pincode, validate_tan as core_validate_tan,
    validate_upi as core_validate_upi, validate_vehicle as core_validate_vehicle,
    validate_voter_id as core_validate_voter_id, ValidationResult,
};
use napi_derive::napi;

fn to_json(result: &ValidationResult) -> String {
    serde_json::to_string(result).unwrap_or_else(|_| {
        r#"{"valid":false,"code":"UNKNOWN_TYPE","reason_en":"Serialization failed","reason_hi":"Serialization fail hua"}"#.to_string()
    })
}

#[napi]
pub fn validate_pan(input: String) -> String {
    to_json(&core_validate_pan(&input))
}

#[napi]
pub fn validate_aadhaar(input: String) -> String {
    to_json(&core_validate_aadhaar(&input))
}

#[napi]
pub fn validate_gstin(input: String) -> String {
    to_json(&core_validate_gstin(&input))
}

#[napi]
pub fn validate_ifsc(input: String) -> String {
    to_json(&core_validate_ifsc(&input))
}

#[napi]
pub fn validate_upi(input: String) -> String {
    to_json(&core_validate_upi(&input))
}

#[napi]
pub fn validate_mobile(input: String) -> String {
    to_json(&core_validate_mobile(&input))
}

#[napi]
pub fn validate_pincode(input: String) -> String {
    to_json(&core_validate_pincode(&input))
}

#[napi]
pub fn format_mobile(input: String) -> Option<String> {
    core_format_mobile(&input)
}

#[napi]
pub fn mask_aadhaar(input: String) -> String {
    core_mask_aadhaar(&input)
}

#[napi]
pub fn detect(input: String) -> String {
    core_detect(&input)
}

#[napi]
pub fn validate_many(inputs: Vec<String>) -> String {
    let results = core_validate_many(&inputs);
    serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
}

#[napi]
pub fn validate_tan(input: String) -> String {
    to_json(&core_validate_tan(&input))
}

#[napi]
pub fn validate_cin(input: String) -> String {
    to_json(&core_validate_cin(&input))
}

#[napi]
pub fn validate_llpin(input: String) -> String {
    to_json(&core_validate_llpin(&input))
}

#[napi]
pub fn validate_voter_id(input: String) -> String {
    to_json(&core_validate_voter_id(&input))
}

#[napi]
pub fn validate_vehicle(input: String) -> String {
    to_json(&core_validate_vehicle(&input))
}

#[napi]
pub fn format_pan(input: String) -> Option<String> {
    core_format_pan(&input)
}

#[napi]
pub fn format_gstin(input: String) -> Option<String> {
    core_format_gstin(&input)
}

#[napi]
pub fn mask_pan(input: String) -> String {
    core_mask_pan(&input)
}

#[napi]
pub fn mask_mobile(input: String) -> String {
    core_mask_mobile(&input)
}

#[napi]
pub fn generate_pan(entity: String) -> String {
    core_generate_pan(entity.chars().next().unwrap_or('P'))
}

#[napi]
pub fn generate_aadhaar() -> String {
    core_generate_aadhaar()
}

#[napi]
pub fn generate_gstin(state_code: String) -> String {
    core_generate_gstin(&state_code)
}

#[napi]
pub fn generate_mobile() -> String {
    core_generate_mobile()
}
