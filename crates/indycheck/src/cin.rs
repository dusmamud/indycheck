use crate::types::ValidationResult;
use serde_json::json;

/// Validates a CIN (Corporate Identity Number), 21 characters:
/// 1 listing char (`L` or `U`) + 5 digits (industry code) + 2 letters
/// (state code) + 4 digits (year of incorporation) + 3 letters (company
/// type) + 6 digits (registration number). Input is upper-cased first.
///
/// NOTE: CIN has NO public checksum. Only the format can be checked
/// offline — a format-valid CIN is not proof that the company exists.
pub fn validate_cin(input: &str) -> ValidationResult {
    let upper = input.trim().to_ascii_uppercase();
    if upper.is_empty() {
        return ValidationResult::err("EMPTY", "CIN is empty", "CIN khaali hai");
    }
    if upper.chars().count() != 21 {
        return ValidationResult::err(
            "INVALID_LENGTH",
            "CIN must be exactly 21 characters",
            "CIN bilkul 21 character ka hona chahiye",
        );
    }
    let chars: Vec<char> = upper.chars().collect();
    let listing_ok = chars[0] == 'L' || chars[0] == 'U';
    let format_ok = chars[1..6].iter().all(|c| c.is_ascii_digit())
        && chars[6..8].iter().all(|c| c.is_ascii_alphabetic())
        && chars[8..12].iter().all(|c| c.is_ascii_digit())
        && chars[12..15].iter().all(|c| c.is_ascii_alphabetic())
        && chars[15..21].iter().all(|c| c.is_ascii_digit());
    if !listing_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "CIN must start with L (listed) or U (unlisted)",
            "CIN L (listed) ya U (unlisted) se shuru hona chahiye",
        );
    }
    if !format_ok {
        return ValidationResult::err(
            "INVALID_FORMAT",
            "CIN format must be L/U + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits (e.g. L12345MH2020PLC123456). CIN has no checksum, so only the format is checked",
            "CIN ka format L/U + 5 digit + 2 akshar + 4 digit + 3 akshar + 6 digit hona chahiye (jaise L12345MH2020PLC123456). CIN ka koi checksum nahi hai, isliye sirf format check hota hai",
        );
    }
    let listing = if chars[0] == 'L' {
        "Listed"
    } else {
        "Unlisted"
    };
    let industry_code: String = chars[1..6].iter().collect();
    let state_code: String = chars[6..8].iter().collect();
    let year: String = chars[8..12].iter().collect();
    let company_type: String = chars[12..15].iter().collect();
    let reg_no: String = chars[15..21].iter().collect();
    ValidationResult::ok(
        "CIN format is valid. CIN has no checksum, so this only checks the format",
        "CIN ka format sahi hai. CIN ka koi checksum nahi hai, isliye sirf format check hua hai",
        Some(json!({
            "cin": upper,
            "listing": listing,
            "industry_code": industry_code,
            "state_code": state_code,
            "year": year,
            "company_type": company_type,
            "registration_number": reg_no,
        })),
    )
}
