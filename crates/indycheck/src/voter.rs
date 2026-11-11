use crate::types::ValidationResult;
use serde_json::json;

/// Validates a Voter ID / EPIC number: 3 letters + 7 digits, after
/// upper-casing.
///
/// NOTE: A Voter ID has NO public checksum. Only the format can be checked
/// offline — a format-valid EPIC number is not proof that the voter exists.
pub fn validate_voter_id(input: &str) -> ValidationResult {
    let upper = input.trim().to_ascii_uppercase();
    if upper.is_empty() {
        return ValidationResult::err("EMPTY", "Voter ID is empty", "Voter ID khaali hai");
    }
    if upper.chars().count() != 10 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "Voter ID must be exactly 10 characters",
            "Voter ID bilkul 10 character ka hona chahiye",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    let format_ok = chars[..3].iter().all(|c| c.is_ascii_alphabetic())
        && chars[3..].iter().all(|c| c.is_ascii_digit());
    if !format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "Voter ID format must be 3 letters followed by 7 digits (e.g. ABC1234567). Voter ID has no checksum, so only the format is checked",
            "Voter ID ka format 3 akshar phir 7 digit hona chahiye (jaise ABC1234567). Voter ID ka koi checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    ValidationResult::ok(
        "Voter ID format is valid. Voter ID has no checksum, so this only checks the format",
        "Voter ID ka format sahi hai. Voter ID ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({ "epic": upper })),
    )
}

/// Alias for [`validate_voter_id`]: EPIC is the name printed on the card.
pub fn validate_epic(input: &str) -> ValidationResult {
    validate_voter_id(input)
}
