use crate::types::ValidationResult;
use serde_json::json;

/// Validates an IFSC: `^[A-Z]{4}0[A-Z0-9]{6}$` after upper-casing.
///
/// NOTE: IFSC has NO checksum. Only the format can be checked offline:
/// 4-letter bank code, `0`, then a 6-character branch code. A format-valid
/// IFSC is not proof that the branch exists — that needs the RBI list.
pub fn validate_ifsc(input: &str) -> ValidationResult {
    let upper = input.trim().to_ascii_uppercase();
    if upper.is_empty() {
        return ValidationResult::err("EMPTY", "IFSC is empty", "IFSC khaali hai");
    }
    if upper.chars().count() != 11 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "IFSC must be exactly 11 characters",
            "IFSC bilkul 11 character ka hona chahiye",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    let format_ok = chars[..4].iter().all(|c| c.is_ascii_alphabetic())
        && chars[4] == '0'
        && chars[5..].iter().all(|c| c.is_ascii_alphanumeric());
    if !format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "IFSC format must be 4 letters, 0, then 6 letters/digits (e.g. SBIN0000123). IFSC has no checksum, so only the format is checked",
            "IFSC ka format 4 akshar, 0, phir 6 akshar/digit hona chahiye (jaise SBIN0000123). IFSC ka koi checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    let bank_code: String = chars[..4].iter().collect();
    let branch_code: String = chars[5..].iter().collect();
    ValidationResult::ok(
        "IFSC format is valid. IFSC has no checksum, so this only checks the format",
        "IFSC ka format sahi hai. IFSC ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({ "bank_code": bank_code, "branch_code": branch_code })),
    )
}
