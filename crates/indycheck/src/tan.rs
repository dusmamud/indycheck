use crate::types::ValidationResult;
use serde_json::json;

/// Validates a TAN (Tax Deduction and Collection Account Number):
/// 4 letters + 5 digits + 1 letter, after upper-casing.
///
/// NOTE: TAN has NO public checksum. Only the format can be checked
/// offline — a format-valid TAN is not proof that it was ever issued.
pub fn validate_tan(input: &str) -> ValidationResult {
    let upper = input.trim().to_ascii_uppercase();
    if upper.is_empty() {
        return ValidationResult::err("EMPTY", "TAN is empty", "TAN khaali hai");
    }
    if upper.chars().count() != 10 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "TAN must be exactly 10 characters",
            "TAN bilkul 10 character ka hona chahiye",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    let format_ok = chars[..4].iter().all(|c| c.is_ascii_alphabetic())
        && chars[4..9].iter().all(|c| c.is_ascii_digit())
        && chars[9].is_ascii_alphabetic();
    if !format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "TAN format must be 4 letters, 5 digits, 1 letter (e.g. ABCD12345E). TAN has no checksum, so only the format is checked",
            "TAN ka format 4 akshar, 5 digit, 1 akshar hona chahiye (jaise ABCD12345E). TAN ka koi checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    ValidationResult::ok(
        "TAN format is valid. TAN has no checksum, so this only checks the format",
        "TAN ka format sahi hai. TAN ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({ "tan": upper })),
    )
}
