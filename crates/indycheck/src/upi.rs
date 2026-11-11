use crate::data::is_known_upi_handle;
use crate::types::ValidationResult;
use serde_json::json;

/// Validates a UPI ID (`name@handle`).
///
/// The name part must be 2-50 characters of letters, digits, `.`, `-` or `_`.
/// The handle must be a known handle from the maintained list in `data.rs`.
/// This is format validation only — it does not prove the UPI ID exists.
pub fn validate_upi(input: &str) -> ValidationResult {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return ValidationResult::err("EMPTY", "UPI ID is empty", "UPI ID khaali hai");
    }
    let parts: Vec<&str> = trimmed.split('@').collect();
    if parts.len() != 2 {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "UPI ID must be in name@handle format (e.g. name@okaxis)",
            "UPI ID name@handle format me hona chahiye (jaise name@okaxis)",
        );
    }
    let (name, handle) = (parts[0], parts[1]);
    if name.len() < 2 || name.len() > 50 {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "UPI name must be 2-50 characters long",
            "UPI name 2 se 50 character ka hona chahiye",
        );
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
    {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "UPI name may only contain letters, digits, dot, hyphen or underscore",
            "UPI name me sirf akshar, digit, dot, hyphen ya underscore ho sakte hain",
        );
    }
    if handle.is_empty() {
        return ValidationResult::err(
            "INVALID_HANDLE",
            "UPI handle is missing after @",
            "UPI handle @ ke baad khaali hai",
        );
    }
    // Handles are lower-case in the list; compare case-insensitively.
    if !is_known_upi_handle(handle) {
        return ValidationResult::err(
            "INVALID_HANDLE",
            "UPI handle is not a known handle",
            "UPI handle jaana-pehchana handle nahi hai",
        );
    }
    ValidationResult::ok(
        "UPI ID format is valid",
        "UPI ID ka format sahi hai",
        Some(json!({ "handle": handle.to_ascii_lowercase() })),
    )
}
