use crate::options::{spaces_hyphens_ok, strip_spaces_hyphens, Options};
use crate::types::ValidationResult;
use crate::verhoeff;
use serde_json::json;

/// Validates a 12-digit Aadhaar number: first digit 2-9, Verhoeff checksum.
pub fn validate_aadhaar(input: &str) -> ValidationResult {
    validate_aadhaar_with_options(input, Options::default())
}

/// Same as [`validate_aadhaar`], with caller-controlled [`Options`].
/// With `strict: false` the first-digit and Verhoeff checksum checks are
/// skipped (12 digits only). With `allow_spaces_hyphens: false`, spaces
/// or hyphens in the input are an `INVALID_FORMAT` error.
pub fn validate_aadhaar_with_options(input: &str, options: Options) -> ValidationResult {
    if input.trim().is_empty() {
        return ValidationResult::err(
            "EMPTY",
            "Aadhaar number is empty",
            "Aadhaar number khaali hai",
        );
    }
    if !spaces_hyphens_ok(input, options) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "Aadhaar number must not contain spaces or hyphens with these options",
            "In options ke saath Aadhaar number me space ya hyphen nahi hona chahiye",
        );
    }
    let cleaned = strip_spaces_hyphens(input.trim(), options);
    if cleaned.chars().count() != 12 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "Aadhaar number must be exactly 12 digits",
            "Aadhaar number bilkul 12 digit ka hona chahiye",
        );
    }
    if !cleaned.bytes().all(|b| b.is_ascii_digit()) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "Aadhaar number must contain only digits",
            "Aadhaar number me sirf digit hone chahiye",
        );
    }
    let first = cleaned.as_bytes()[0];
    if options.strict && !(b'2'..=b'9').contains(&first) {
        return ValidationResult::err(
            "INVALID_FIRST_DIGIT",
            "Aadhaar number must start with 2-9",
            "Aadhaar number 2 se 9 ke beech wale digit se shuru hona chahiye",
        );
    }
    if options.strict && !verhoeff::is_valid(&cleaned) {
        return ValidationResult::err(
            "INVALID_CHECKSUM",
            "Aadhaar checksum is invalid (Verhoeff check failed)",
            "Aadhaar ka checksum galat hai (Verhoeff check fail hua)",
        );
    }
    ValidationResult::ok(
        "Aadhaar number format and checksum are valid",
        "Aadhaar number ka format aur checksum sahi hai",
        Some(json!({ "masked": mask_aadhaar(&cleaned) })),
    )
}

/// Masks an Aadhaar number as `XXXX XXXX 1234`.
///
/// Returns an empty string when the input is not a valid-format
/// 12-digit Aadhaar (digits only, after stripping spaces/hyphens).
/// This is documented behaviour: callers must not treat a non-empty
/// result as proof of validity — use `validate_aadhaar` for that.
pub fn mask_aadhaar(input: &str) -> String {
    let cleaned: String = input
        .trim()
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect();
    if cleaned.chars().count() != 12 || !cleaned.bytes().all(|b| b.is_ascii_digit()) {
        return String::new();
    }
    format!("XXXX XXXX {}", &cleaned[8..])
}
