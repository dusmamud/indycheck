use crate::data::state_name;
use crate::luhn36;
use crate::options::{maybe_uppercase, spaces_hyphens_ok, strip_spaces_hyphens, Options};
use crate::types::ValidationResult;
use serde_json::json;

/// Validates a 15-character GSTIN:
/// 2-digit state code + 10-character PAN + 1 entity char + `Z` + Mod-36 check digit.
pub fn validate_gstin(input: &str) -> ValidationResult {
    validate_gstin_with_options(input, Options::default())
}

/// Same as [`validate_gstin`], with caller-controlled [`Options`].
/// With `strict: false` the Mod-36 check-digit check is skipped (format
/// and state code still checked). With `allow_spaces_hyphens: false`,
/// spaces or hyphens in the input are an `INVALID_FORMAT` error.
pub fn validate_gstin_with_options(input: &str, options: Options) -> ValidationResult {
    if input.trim().is_empty() {
        return ValidationResult::err("EMPTY", "GSTIN is empty", "GSTIN khaali hai");
    }
    if !spaces_hyphens_ok(input, options) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN must not contain spaces or hyphens with these options",
            "In options ke saath GSTIN me space ya hyphen nahi hona chahiye",
        );
    }
    let upper = strip_spaces_hyphens(&maybe_uppercase(input, options), options);
    if !options.uppercase && upper.chars().any(|c| c.is_ascii_lowercase()) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN must be upper-case with these options",
            "In options ke saath GSTIN upper-case me hona chahiye",
        );
    }
    if upper.chars().count() != 15 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "GSTIN must be exactly 15 characters",
            "GSTIN bilkul 15 character ka hona chahiye",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    if !chars[..2].iter().all(|c| c.is_ascii_digit()) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN must start with a 2-digit state code",
            "GSTIN 2 digit ke state code se shuru hona chahiye",
        );
    }
    let state_code: String = chars[..2].iter().collect();
    let state = match state_name(&state_code) {
        Some(name) => name,
        None => {
            return ValidationResult::err(
                "INVALID_STATE_CODE",
                "GSTIN state code is not a valid Indian state code (01-38)",
                "GSTIN ka state code sahi nahi hai (01-38 ke beech hona chahiye)",
            )
        }
    };
    // Characters 3-12 are the PAN; check its format (letters/digits pattern only).
    let pan: String = chars[2..12].iter().collect();
    let pan_chars: Vec<char> = pan.chars().collect();
    let pan_format_ok = pan_chars[..5].iter().all(|c| c.is_ascii_alphabetic())
        && pan_chars[5..9].iter().all(|c| c.is_ascii_digit())
        && pan_chars[9].is_ascii_alphabetic();
    if !pan_format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN characters 3-12 must be a PAN in 5 letters, 4 digits, 1 letter format",
            "GSTIN ke 3 se 12 tak ke character PAN format me hone chahiye (5 akshar, 4 digit, 1 akshar)",
        );
    }
    // 13th character is the entity number/letter (alphanumeric).
    if !chars[12].is_ascii_alphanumeric() {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN 13th character must be a letter or digit (entity number)",
            "GSTIN ka 13th character akshar ya digit hona chahiye",
        );
    }
    if chars[13] != 'Z' {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN 14th character must be Z",
            "GSTIN ka 14th character Z hona chahiye",
        );
    }
    if !chars[14].is_ascii_alphanumeric() {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "GSTIN 15th character must be a letter or digit (check digit)",
            "GSTIN ka 15th character akshar ya digit hona chahiye",
        );
    }
    if options.strict && !luhn36::is_valid(&upper) {
        return ValidationResult::err(
            "INVALID_CHECKSUM",
            "GSTIN check digit is invalid (Mod-36 Luhn check failed)",
            "GSTIN ka check digit galat hai (Mod-36 Luhn check fail hua)",
        );
    }
    ValidationResult::ok(
        "GSTIN format, state code and check digit are valid",
        "GSTIN ka format, state code aur check digit sahi hai",
        Some(json!({ "state": state, "state_code": state_code, "pan": pan })),
    )
}

/// Formats a GSTIN: upper-cases it and strips spaces/hyphens.
/// Returns `Some("18AAAPL1234C1ZD")` when the result is structurally a
/// GSTIN (state code, PAN part and `Z` all in place; the check digit is
/// NOT verified here), otherwise `None`.
pub fn format_gstin(input: &str) -> Option<String> {
    let result = validate_gstin_with_options(input, Options::lenient());
    if result.valid {
        let upper = strip_spaces_hyphens(
            &maybe_uppercase(input, Options::default()),
            Options::default(),
        );
        Some(upper)
    } else {
        None
    }
}
