use crate::types::ValidationResult;
use serde_json::json;

/// Validates an Indian vehicle registration number, e.g. `DL01AB1234` or
/// `DL01A1234`. Spaces and hyphens are stripped and letters upper-cased
/// first. Accepted shape: 2 state-code letters + 1-2 digit district code
/// + 1-2 letter series + 1-4 digit number.
///
/// NOTE: this is format only. The 2-letter state code is not checked
/// against a list of states, and there is no checksum — a format-valid
/// registration number is not proof that the vehicle exists.
pub fn validate_vehicle(input: &str) -> ValidationResult {
    let cleaned: String = input
        .trim()
        .to_ascii_uppercase()
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect();
    if cleaned.is_empty() {
        return ValidationResult::err(
            "EMPTY",
            "Vehicle registration number is empty",
            "Vehicle registration number khaali hai",
        );
    }
    let chars: Vec<char> = cleaned.chars().collect();
    if chars.len() < 8 || chars.len() > 10 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "Vehicle registration number must be 8-10 characters (e.g. DL01AB1234)",
            "Vehicle registration number 8 se 10 character ka hona chahiye (jaise DL01AB1234)",
        );
    }
    if !chars[..2].iter().all(|c| c.is_ascii_alphabetic()) {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234)",
            "Vehicle registration number 2 state-code akshar se shuru hona chahiye (jaise DL01AB1234)",
        );
    }
    // Parse: district digits (1-2), series letters (1-2), number digits (1-4).
    let mut i = 2usize;
    let district_start = i;
    while i < chars.len() && chars[i].is_ascii_digit() && i - district_start < 2 {
        i += 1;
    }
    let district: String = chars[district_start..i].iter().collect();
    let series_start = i;
    while i < chars.len() && chars[i].is_ascii_alphabetic() && i - series_start < 2 {
        i += 1;
    }
    let series: String = chars[series_start..i].iter().collect();
    let number_start = i;
    while i < chars.len() && chars[i].is_ascii_digit() && i - number_start < 4 {
        i += 1;
    }
    let number: String = chars[number_start..i].iter().collect();
    let format_ok =
        !district.is_empty() && !series.is_empty() && !number.is_empty() && i == chars.len();
    if !format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "Vehicle registration format must be state letters + district digits + series letters + number digits (e.g. DL01AB1234). Registration numbers have no checksum, so only the format is checked",
            "Vehicle registration ka format state akshar + district digit + series akshar + number digit hona chahiye (jaise DL01AB1234). Registration number ka koi checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    let state_code: String = chars[..2].iter().collect();
    ValidationResult::ok(
        "Vehicle registration format is valid. Registration numbers have no checksum, so this only checks the format",
        "Vehicle registration ka format sahi hai. Registration number ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({
            "registration": cleaned,
            "state_code": state_code,
            "district": district,
            "series": series,
            "number": number,
        })),
    )
}

/// Alias for [`validate_vehicle`].
pub fn validate_vehicle_registration(input: &str) -> ValidationResult {
    validate_vehicle(input)
}
