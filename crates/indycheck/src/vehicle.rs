use crate::types::ValidationResult;
use serde_json::json;

/// Validates an Indian vehicle registration number, e.g. `DL01AB1234` or
/// `DL01A1234`, or a Bharat (BH) series number, e.g. `22BH1234AA`.
/// Spaces and hyphens are stripped and letters upper-cased first.
///
/// State format: 2 state-code letters + 1-2 digit district code
/// + 1-2 letter series + 1-4 digit number.
///
/// Bharat format (`YYBH####XX`, MoRTH notification 26 Aug 2021, effective
/// 15 Sep 2021): 2-digit registration year + `BH` + 4-digit number
/// (0001-9999) + 2 suffix letters. The year must be 21 or later, and the
/// suffix letters exclude `I` and `O` (they look like digits on a plate).
/// BH numbers are state-neutral — there is no state code or district.
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
    // Bharat (BH) series: starts with 2 digits (the registration year),
    // so it must be checked before the state format, which requires 2
    // leading letters.
    if chars[..2].iter().all(|c| c.is_ascii_digit()) {
        return validate_bharat(&cleaned, &chars);
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
            "series_type": "state",
            "state_code": state_code,
            "district": district,
            "series": series,
            "number": number,
        })),
    )
}

/// Bharat (BH) series: `YYBH####XX` — 2-digit year, `BH`, 4-digit number,
/// 2 suffix letters. Called only when the cleaned input starts with digits.
fn validate_bharat(cleaned: &str, chars: &[char]) -> ValidationResult {
    let not_bharat = |detail_en: &str, detail_hi: &str| {
        ValidationResult::err("INVALID_FORMAT", detail_en, detail_hi)
    };
    let is_digit_range =
        |from: usize, to: usize| chars[from..to].iter().all(|c| c.is_ascii_digit());
    // Shape: exactly 10 chars, `BH` at 2-3, 4 digits, 2 letters.
    let shape_ok = chars.len() == 10
        && chars[2..4] == ['B', 'H']
        && is_digit_range(4, 8)
        && chars[8..10].iter().all(|c| c.is_ascii_alphabetic());
    if !shape_ok {
        // A digit-starting input that is not a BH number is not a state
        // number either (those start with 2 letters).
        return not_bharat(
            "Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234), or be a Bharat series number (e.g. 22BH1234AA)",
            "Vehicle registration number 2 state-code akshar se shuru hona chahiye (jaise DL01AB1234), ya Bharat series number hona chahiye (jaise 22BH1234AA)",
        );
    }
    let year: String = chars[..2].iter().collect();
    let year_num: u32 = year.parse().unwrap_or(0);
    if year_num < 21 {
        return not_bharat(
            "Bharat (BH) series numbers start from 2021 — the year must be 21 or later (e.g. 22BH1234AA)",
            "Bharat (BH) series number 2021 se shuru hue hain — saal 21 ya usse baad ka hona chahiye (jaise 22BH1234AA)",
        );
    }
    let number: String = chars[4..8].iter().collect();
    if number == "0000" {
        return not_bharat(
            "Bharat (BH) series number must be 0001-9999 (e.g. 22BH1234AA)",
            "Bharat (BH) series number 0001 se 9999 ke beech hona chahiye (jaise 22BH1234AA)",
        );
    }
    let suffix: String = chars[8..10].iter().collect();
    if suffix.contains('I') || suffix.contains('O') {
        return not_bharat(
            "Bharat (BH) series suffix letters cannot be I or O (e.g. 22BH1234AA)",
            "Bharat (BH) series ke aakhiri akshar I ya O nahi ho sakte (jaise 22BH1234AA)",
        );
    }
    ValidationResult::ok(
        "Bharat (BH) series vehicle registration format is valid. Registration numbers have no checksum, so this only checks the format",
        "Bharat (BH) series vehicle registration ka format sahi hai. Registration number ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({
            "registration": cleaned,
            "series_type": "bharat",
            "year": year,
            "series": "BH",
            "number": number,
            "suffix": suffix,
        })),
    )
}

/// Alias for [`validate_vehicle`].
pub fn validate_vehicle_registration(input: &str) -> ValidationResult {
    validate_vehicle(input)
}
