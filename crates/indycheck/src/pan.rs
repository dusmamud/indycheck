use crate::options::{maybe_uppercase, spaces_hyphens_ok, strip_spaces_hyphens, Options};
use crate::types::ValidationResult;
use serde_json::json;

/// PAN entity types by the 4th character of the PAN.
pub fn entity_name(code: char) -> Option<&'static str> {
    match code {
        'P' => Some("Individual"),
        'C' => Some("Company"),
        'H' => Some("HUF"),
        'F' => Some("Firm"),
        'A' => Some("AOP"),
        'T' => Some("Trust"),
        'B' => Some("BODY"),
        'L' => Some("Local Authority"),
        'J' => Some("Artificial Juridical Person"),
        'G' => Some("Government"),
        _ => None,
    }
}

/// Returns `true` when `pan` (already upper-cased) matches
/// `^[A-Z]{5}[0-9]{4}[A-Z]$`.
pub fn is_pan_pattern(pan: &str) -> bool {
    let chars: Vec<char> = pan.chars().collect();
    chars.len() == 10
        && chars[..5].iter().all(|c| c.is_ascii_alphabetic())
        && chars[5..9].iter().all(|c| c.is_ascii_digit())
        && chars[9].is_ascii_alphabetic()
}

/// Validates a PAN: `^[A-Z]{5}[0-9]{4}[A-Z]$` after upper-casing.
///
/// NOTE: PAN has NO public checksum. Only the format and the 4th-character
/// entity code can be checked offline. A format-valid PAN is not proof that
/// the PAN exists or belongs to anyone — that needs NSDL/Income Tax
/// verification, which this library deliberately does not do.
pub fn validate_pan(input: &str) -> ValidationResult {
    validate_pan_with_options(input, Options::default())
}

/// Same as [`validate_pan`], with caller-controlled [`Options`].
/// For PAN, `strict`/`lenient` make no difference (there is no checksum or
/// first-digit rule to skip); `uppercase` and `allow_spaces_hyphens` do.
pub fn validate_pan_with_options(input: &str, options: Options) -> ValidationResult {
    if input.trim().is_empty() {
        return ValidationResult::err("EMPTY", "PAN is empty", "PAN khaali hai");
    }
    if !spaces_hyphens_ok(input, options) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "PAN must not contain spaces or hyphens with these options",
            "In options ke saath PAN me space ya hyphen nahi hona chahiye",
        );
    }
    let upper = strip_spaces_hyphens(&maybe_uppercase(input, options), options);
    if !options.uppercase && upper.chars().any(|c| c.is_ascii_lowercase()) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "PAN must be upper-case with these options",
            "In options ke saath PAN upper-case me hona chahiye",
        );
    }
    if upper.chars().count() != 10 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "PAN must be exactly 10 characters",
            "PAN bilkul 10 character ka hona chahiye",
        );
    }
    if !is_pan_pattern(&upper) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "PAN format must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). PAN has no public checksum, so only the format is checked",
            "PAN ka format 5 akshar, 4 digit, 1 akshar hona chahiye (jaise ABCDE1234F). PAN ka koi public checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    // An unlisted 4th character is reported as entity "Unknown" and the PAN
    // is still format-valid: the canonical format example ABCDE1234F itself
    // has 4th character D, which is not in the published entity list, so
    // rejecting unknown entity codes would reject the standard example.
    // INVALID_ENTITY is therefore a reserved stable code, not emitted in v0.1.
    let entity = entity_name(chars[3]).unwrap_or("Unknown");
    ValidationResult::ok(
        "PAN format is valid. PAN has no public checksum, so this only checks the format",
        "PAN ka format sahi hai. PAN ka koi public checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({ "entity": entity, "entity_code": chars[3].to_string() })),
    )
}

/// Formats a PAN: upper-cases it and strips spaces/hyphens.
/// Returns `Some("ABCDE1234F")` when the result matches the PAN pattern,
/// otherwise `None`.
pub fn format_pan(input: &str) -> Option<String> {
    let upper = strip_spaces_hyphens(
        &maybe_uppercase(input, Options::default()),
        Options::default(),
    );
    if is_pan_pattern(&upper) {
        Some(upper)
    } else {
        None
    }
}

/// Masks a PAN as `ABCDE****F` (first 5 chars, 4 asterisks, last char).
///
/// Returns an empty string when the input is not a valid-format PAN.
/// A non-empty result is not proof of validity — use `validate_pan` for that.
pub fn mask_pan(input: &str) -> String {
    match format_pan(input) {
        Some(pan) => format!("{}****{}", &pan[..5], &pan[9..]),
        None => String::new(),
    }
}
