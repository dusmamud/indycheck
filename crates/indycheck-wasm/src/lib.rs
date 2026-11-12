//! WASM bindings for indycheck — thin wrappers over the Rust core.
//!
//! All validation logic lives in the `indycheck` crate; this crate only
//! converts results to `JsValue` (JSON) for JavaScript callers.
//! Build with: `wasm-pack build --target web` (from this directory).

use indycheck::{
    ValidationResult, detect as core_detect, format_gstin as core_format_gstin,
    format_pan as core_format_pan, generate_aadhaar as core_generate_aadhaar,
    generate_gstin as core_generate_gstin, generate_mobile as core_generate_mobile,
    generate_pan as core_generate_pan, generate_vehicle as core_generate_vehicle,
    generate_vehicle_bharat as core_generate_vehicle_bharat, mask_aadhaar as core_mask_aadhaar,
    mask_mobile as core_mask_mobile, mask_pan as core_mask_pan,
    validate_aadhaar as core_validate_aadhaar, validate_cin as core_validate_cin,
    validate_gstin as core_validate_gstin, validate_ifsc as core_validate_ifsc,
    validate_llpin as core_validate_llpin, validate_many as core_validate_many,
    validate_mobile as core_validate_mobile, validate_pan as core_validate_pan,
    validate_pincode as core_validate_pincode, validate_tan as core_validate_tan,
    validate_upi as core_validate_upi, validate_vehicle as core_validate_vehicle,
    validate_voter_id as core_validate_voter_id,
};
use wasm_bindgen::prelude::*;

fn to_js(result: &ValidationResult) -> JsValue {
    match serde_json::to_string(result) {
        Ok(json) => JsValue::from_str(&json),
        Err(_) => JsValue::from_str(
            r#"{"valid":false,"code":"UNKNOWN_TYPE","reason_en":"Serialization failed","reason_hi":"Serialization fail hua"}"#,
        ),
    }
}

#[wasm_bindgen]
pub fn validate_pan(input: String) -> JsValue {
    to_js(&core_validate_pan(&input))
}

#[wasm_bindgen]
pub fn validate_aadhaar(input: String) -> JsValue {
    to_js(&core_validate_aadhaar(&input))
}

#[wasm_bindgen]
pub fn validate_gstin(input: String) -> JsValue {
    to_js(&core_validate_gstin(&input))
}

#[wasm_bindgen]
pub fn validate_ifsc(input: String) -> JsValue {
    to_js(&core_validate_ifsc(&input))
}

#[wasm_bindgen]
pub fn validate_upi(input: String) -> JsValue {
    to_js(&core_validate_upi(&input))
}

#[wasm_bindgen]
pub fn validate_mobile(input: String) -> JsValue {
    to_js(&core_validate_mobile(&input))
}

#[wasm_bindgen]
pub fn validate_pincode(input: String) -> JsValue {
    to_js(&core_validate_pincode(&input))
}

#[wasm_bindgen]
pub fn mask_aadhaar(input: String) -> String {
    core_mask_aadhaar(&input)
}

#[wasm_bindgen]
pub fn detect(input: String) -> String {
    core_detect(&input)
}

#[wasm_bindgen]
pub fn validate_many(inputs: Vec<String>) -> JsValue {
    let results = core_validate_many(&inputs);
    match serde_json::to_string(&results) {
        Ok(json) => JsValue::from_str(&json),
        Err(_) => JsValue::from_str("[]"),
    }
}

#[wasm_bindgen]
pub fn validate_tan(input: String) -> JsValue {
    to_js(&core_validate_tan(&input))
}

#[wasm_bindgen]
pub fn validate_cin(input: String) -> JsValue {
    to_js(&core_validate_cin(&input))
}

#[wasm_bindgen]
pub fn validate_llpin(input: String) -> JsValue {
    to_js(&core_validate_llpin(&input))
}

#[wasm_bindgen]
pub fn validate_voter_id(input: String) -> JsValue {
    to_js(&core_validate_voter_id(&input))
}

#[wasm_bindgen]
pub fn validate_vehicle(input: String) -> JsValue {
    to_js(&core_validate_vehicle(&input))
}

#[wasm_bindgen]
pub fn format_pan(input: String) -> Option<String> {
    core_format_pan(&input)
}

#[wasm_bindgen]
pub fn format_gstin(input: String) -> Option<String> {
    core_format_gstin(&input)
}

#[wasm_bindgen]
pub fn mask_pan(input: String) -> String {
    core_mask_pan(&input)
}

#[wasm_bindgen]
pub fn mask_mobile(input: String) -> String {
    core_mask_mobile(&input)
}

#[wasm_bindgen]
pub fn generate_pan(entity: String) -> String {
    core_generate_pan(entity.chars().next().unwrap_or('P'))
}

#[wasm_bindgen]
pub fn generate_aadhaar() -> String {
    core_generate_aadhaar()
}

#[wasm_bindgen]
pub fn generate_gstin(state_code: String) -> String {
    core_generate_gstin(&state_code)
}

#[wasm_bindgen]
pub fn generate_mobile() -> String {
    core_generate_mobile()
}

#[wasm_bindgen]
pub fn generate_vehicle() -> String {
    core_generate_vehicle()
}

#[wasm_bindgen]
pub fn generate_vehicle_bharat() -> String {
    core_generate_vehicle_bharat()
}
