use crate::options::Options;
use crate::types::ValidationResult;
use serde_json::json;

/// Normalises an Indian mobile number: strips spaces and hyphens, then
/// removes a leading `+91`, `91` (12-digit form) or `0` (11-digit form).
/// Returns `None` when the result is not exactly 10 ASCII digits.
/// Uses default options (spaces/hyphens and `+91` allowed).
pub fn normalize_mobile(input: &str) -> Option<String> {
    normalize_mobile_with_options(input, Options::default())
}

/// Same as [`normalize_mobile`], with caller-controlled [`Options`].
/// With `normalise_plus91: false` only a bare 10-digit number is accepted;
/// with `allow_spaces_hyphens: false` any space or hyphen rejects the input.
pub fn normalize_mobile_with_options(input: &str, options: Options) -> Option<String> {
    let cleaned: String = if options.allow_spaces_hyphens {
        input
            .trim()
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-')
            .collect()
    } else {
        if input.chars().any(|c| c.is_whitespace() || c == '-') {
            return None;
        }
        input.trim().to_string()
    };
    if !options.normalise_plus91 {
        if cleaned.len() == 10 && cleaned.bytes().all(|b| b.is_ascii_digit()) {
            return Some(cleaned);
        }
        return None;
    }
    let without_plus = cleaned.strip_prefix('+').unwrap_or(&cleaned);
    let digits: &str = if let Some(rest) = without_plus.strip_prefix("91") {
        // Only treat a leading 91 as a country code when it makes 10 digits.
        if rest.len() == 10 { rest } else { without_plus }
    } else if let Some(rest) = without_plus.strip_prefix('0') {
        if rest.len() == 10 { rest } else { without_plus }
    } else {
        without_plus
    };
    if digits.len() == 10 && digits.bytes().all(|b| b.is_ascii_digit()) {
        Some(digits.to_string())
    } else {
        None
    }
}

/// Returns the normalised 10-digit number, or `None` when it is not a
/// valid-format Indian mobile number.
pub fn format_mobile(input: &str) -> Option<String> {
    format_mobile_with_options(input, Options::default())
}

/// Same as [`format_mobile`], with caller-controlled [`Options`].
/// Lenient options skip the first-digit (6-9) rule.
pub fn format_mobile_with_options(input: &str, options: Options) -> Option<String> {
    match normalize_mobile_with_options(input, options) {
        Some(n) if !options.strict || matches!(n.as_bytes().first(), Some(b'6'..=b'9')) => Some(n),
        _ => None,
    }
}

/// Validates an Indian mobile number (10 digits, first digit 6-9;
/// `+91` / `91` / `0` prefix, spaces and hyphens allowed by default).
pub fn validate_mobile(input: &str) -> ValidationResult {
    validate_mobile_with_options(input, Options::default())
}

/// Same as [`validate_mobile`], with caller-controlled [`Options`].
/// With `strict: false` the first-digit rule is skipped (format only).
pub fn validate_mobile_with_options(input: &str, options: Options) -> ValidationResult {
    if input.trim().is_empty() {
        return ValidationResult::err(
            "EMPTY",
            "Mobile number is empty",
            "Mobile number khaali hai",
        );
    }
    match normalize_mobile_with_options(input, options) {
        None => ValidationResult::err(
            "INVALID_FORMAT",
            "Mobile number must be 10 digits, optionally with +91, 91 or 0 prefix",
            "Mobile number 10 digit ka hona chahiye, +91, 91 ya 0 ke saath bhi chalega",
        ),
        Some(normalized) => {
            let first = normalized.as_bytes()[0];
            if options.strict && !(b'6'..=b'9').contains(&first) {
                return ValidationResult::err(
                    "INVALID_FIRST_DIGIT",
                    "Indian mobile numbers start with 6, 7, 8 or 9",
                    "Bharat ke mobile number 6, 7, 8 ya 9 se shuru hote hain",
                );
            }
            ValidationResult::ok(
                "Mobile number format is valid",
                "Mobile number ka format sahi hai",
                Some(json!({ "normalized": normalized })),
            )
        }
    }
}

/// Masks a mobile number as `******3210` (6 asterisks + last 4 digits).
///
/// Returns an empty string when the input is not a valid-format mobile
/// number. A non-empty result is not proof of validity.
pub fn mask_mobile(input: &str) -> String {
    match format_mobile(input) {
        Some(normalized) => format!("******{}", &normalized[6..]),
        None => String::new(),
    }
}
