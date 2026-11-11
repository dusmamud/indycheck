use crate::types::ValidationResult;
use serde_json::json;

/// Validates an Indian PIN code: 6 digits, first digit 1-9.
/// Format only — there is no checksum for PIN codes.
pub fn validate_pincode(input: &str) -> ValidationResult {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return ValidationResult::err("EMPTY", "PIN code is empty", "PIN code khaali hai");
    }
    if trimmed.chars().count() != 6 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "PIN code must be exactly 6 digits",
            "PIN code bilkul 6 digit ka hona chahiye",
        );
    }
    if !trimmed.bytes().all(|b| b.is_ascii_digit()) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "PIN code must contain only digits",
            "PIN code me sirf digit hone chahiye",
        );
    }
    if !matches!(trimmed.as_bytes()[0], b'1'..=b'9') {
        return ValidationResult::err(
            "INVALID_FIRST_DIGIT",
            "PIN code must start with 1-9",
            "PIN code 1 se 9 ke beech wale digit se shuru hona chahiye",
        );
    }
    ValidationResult::ok(
        "PIN code format is valid",
        "PIN code ka format sahi hai",
        Some(json!({ "pincode": trimmed })),
    )
}
