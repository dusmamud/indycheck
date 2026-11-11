use crate::types::ValidationResult;
use serde_json::json;

/// Validates an LLPIN (Limited Liability Partnership Identification
/// Number): 3 letters + 4 digits, after upper-casing.
///
/// NOTE: LLPIN has NO public checksum. Only the format can be checked
/// offline.
pub fn validate_llpin(input: &str) -> ValidationResult {
    let upper = input.trim().to_ascii_uppercase();
    if upper.is_empty() {
        return ValidationResult::err("EMPTY", "LLPIN is empty", "LLPIN khaali hai");
    }
    if upper.chars().count() != 7 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "LLPIN must be exactly 7 characters",
            "LLPIN bilkul 7 character ka hona chahiye",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    let format_ok = chars[..3].iter().all(|c| c.is_ascii_alphabetic())
        && chars[3..].iter().all(|c| c.is_ascii_digit());
    if !format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "LLPIN format must be 3 letters followed by 4 digits (e.g. AAA1234). LLPIN has no checksum, so only the format is checked",
            "LLPIN ka format 3 akshar phir 4 digit hona chahiye (jaise AAA1234). LLPIN ka koi checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    ValidationResult::ok(
        "LLPIN format is valid. LLPIN has no checksum, so this only checks the format",
        "LLPIN ka format sahi hai. LLPIN ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({ "llpin": upper })),
    )
}
