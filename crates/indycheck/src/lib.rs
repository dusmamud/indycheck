//! indycheck — offline Indian ID validator.
//!
//! Validates PAN, Aadhaar, GSTIN, IFSC, UPI, Indian mobile numbers, PIN
//! codes, TAN, CIN, LLPIN, Voter ID / EPIC and vehicle registration
//! numbers entirely offline. Every function returns a [`ValidationResult`]
//! and never panics on bad input.
//!
//! Honest limits: this checks format and (where one exists) checksum only.
//! It does **not** verify that an ID really exists or belongs to anyone —
//! that needs UIDAI / NSDL / GSTN / RBI, which this library never contacts.
//! PAN, IFSC, TAN, CIN, LLPIN, Voter ID and vehicle registration numbers
//! have no public checksum, so only their format is checked.

pub mod aadhaar;
pub mod cin;
pub mod data;
pub mod generate;
pub mod gstin;
pub mod ifsc;
pub mod llpin;
pub mod luhn36;
pub mod mobile;
pub mod options;
pub mod pan;
pub mod pincode;
pub mod tan;
pub mod types;
pub mod upi;
pub mod vehicle;
pub mod verhoeff;
pub mod voter;

pub use aadhaar::{mask_aadhaar, validate_aadhaar, validate_aadhaar_with_options};
pub use cin::validate_cin;
pub use generate::{generate_aadhaar, generate_gstin, generate_mobile, generate_pan};
pub use gstin::{format_gstin, validate_gstin, validate_gstin_with_options};
pub use ifsc::validate_ifsc;
pub use llpin::validate_llpin;
pub use mobile::{
    format_mobile, format_mobile_with_options, mask_mobile, validate_mobile,
    validate_mobile_with_options,
};
pub use options::Options;
pub use pan::{format_pan, mask_pan, validate_pan, validate_pan_with_options};
pub use pincode::validate_pincode;
pub use tan::validate_tan;
pub use types::ValidationResult;
pub use upi::validate_upi;
pub use vehicle::{validate_vehicle, validate_vehicle_registration};
pub use voter::{validate_epic, validate_voter_id};

fn is_pan_pattern(s: &str) -> bool {
    pan::is_pan_pattern(s)
}

fn is_ifsc_pattern(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    chars.len() == 11
        && chars[..4].iter().all(|c| c.is_ascii_alphabetic())
        && chars[4] == '0'
        && chars[5..].iter().all(|c| c.is_ascii_alphanumeric())
}

fn is_tan_pattern(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    chars.len() == 10
        && chars[..4].iter().all(|c| c.is_ascii_alphabetic())
        && chars[4..9].iter().all(|c| c.is_ascii_digit())
        && chars[9].is_ascii_alphabetic()
}

fn is_voter_pattern(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    chars.len() == 10
        && chars[..3].iter().all(|c| c.is_ascii_alphabetic())
        && chars[3..].iter().all(|c| c.is_ascii_digit())
}

fn is_cin_pattern(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    chars.len() == 21
        && (chars[0] == 'L' || chars[0] == 'U')
        && chars[1..6].iter().all(|c| c.is_ascii_digit())
        && chars[6..8].iter().all(|c| c.is_ascii_alphabetic())
        && chars[8..12].iter().all(|c| c.is_ascii_digit())
        && chars[12..15].iter().all(|c| c.is_ascii_alphabetic())
        && chars[15..21].iter().all(|c| c.is_ascii_digit())
}

fn is_llpin_pattern(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    chars.len() == 7
        && chars[..3].iter().all(|c| c.is_ascii_alphabetic())
        && chars[3..].iter().all(|c| c.is_ascii_digit())
}

fn is_vehicle_pattern(s: &str) -> bool {
    // Cheap structural check used only by detect(); the real validation
    // (district/series/number parsing) lives in vehicle::validate_vehicle.
    let cleaned: String = s
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect();
    validate_vehicle(&cleaned).valid
}

/// Detects the type of an Indian ID string.
///
/// Returns one of `"pan"`, `"aadhaar"`, `"gstin"`, `"ifsc"`, `"upi"`,
/// `"mobile"`, `"pincode"`, `"tan"`, `"cin"`, `"llpin"`, `"voter"`,
/// `"vehicle"` or `"unknown"`.
/// GSTIN is tried before PAN and Aadhaar before mobile (by length);
/// UPI is detected by the presence of `@`.
pub fn detect(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return "unknown".to_string();
    }
    if trimmed.contains('@') {
        return "upi".to_string();
    }
    let upper = trimmed.to_ascii_uppercase();
    let len = trimmed.chars().count();
    let all_digits = trimmed.bytes().all(|b| b.is_ascii_digit());
    // A Verhoeff-valid 12-digit number is an Aadhaar even if it also looks
    // like a 91-prefixed mobile; otherwise a normalisable mobile wins over
    // the length-15 GSTIN branch (e.g. "+91 98765 43210" is 15 chars long).
    if len == 12 && all_digits && verhoeff::is_valid(trimmed) {
        return "aadhaar".to_string();
    }
    // Spaced / hyphenated Aadhaar, e.g. "2345 6789 0124".
    let digits_only: String = trimmed.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits_only.chars().count() == 12 && verhoeff::is_valid(&digits_only) {
        return "aadhaar".to_string();
    }
    if mobile::normalize_mobile(trimmed).is_some() {
        return "mobile".to_string();
    }
    // CIN is 21 chars and unambiguous by length.
    if len == 21 && is_cin_pattern(&upper) {
        return "cin".to_string();
    }
    match len {
        15 => return "gstin".to_string(),
        12 if all_digits => return "aadhaar".to_string(),
        11 if is_ifsc_pattern(&upper) => return "ifsc".to_string(),
        10 if is_pan_pattern(&upper) => return "pan".to_string(),
        10 if is_tan_pattern(&upper) => return "tan".to_string(),
        10 if is_voter_pattern(&upper) => return "voter".to_string(),
        10 if all_digits => return "mobile".to_string(),
        7 if is_llpin_pattern(&upper) => return "llpin".to_string(),
        6 if all_digits => return "pincode".to_string(),
        _ => {}
    }
    // Formatted mobiles such as "+91 98765 43210" are longer than 10 chars.
    if format_mobile(trimmed).is_some() {
        return "mobile".to_string();
    }
    if is_pan_pattern(&upper) {
        return "pan".to_string();
    }
    if is_tan_pattern(&upper) {
        return "tan".to_string();
    }
    if is_voter_pattern(&upper) {
        return "voter".to_string();
    }
    if is_ifsc_pattern(&upper) {
        return "ifsc".to_string();
    }
    if is_llpin_pattern(&upper) {
        return "llpin".to_string();
    }
    if is_vehicle_pattern(&upper) {
        return "vehicle".to_string();
    }
    "unknown".to_string()
}

/// Validates many inputs in one call: each input is detected and then
/// validated with the matching validator. Intended for FFI / WASM batch use.
pub fn validate_many(inputs: &[String]) -> Vec<ValidationResult> {
    inputs
        .iter()
        .map(|input| match detect(input).as_str() {
            "pan" => validate_pan(input),
            "aadhaar" => validate_aadhaar(input),
            "gstin" => validate_gstin(input),
            "ifsc" => validate_ifsc(input),
            "upi" => validate_upi(input),
            "mobile" => validate_mobile(input),
            "pincode" => validate_pincode(input),
            "tan" => validate_tan(input),
            "cin" => validate_cin(input),
            "llpin" => validate_llpin(input),
            "voter" => validate_voter_id(input),
            "vehicle" => validate_vehicle(input),
            _ => ValidationResult::err(
                "UNKNOWN_TYPE",
                "Could not detect the type of this input",
                "Is input ka type pehchana nahi ja saka",
            ),
        })
        .collect()
}
