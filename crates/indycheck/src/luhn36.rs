//! Mod-36 Luhn check digit, as used by the 15-character GSTIN.
//!
//! Alphabet is `0-9A-Z` (values 0-35). Starting from the rightmost
//! character of the first 14 characters, the factor alternates 2, 1, 2, 1...
//! Each product is split into its base-36 digits (`product / 36 + product % 36`)
//! and summed. The check digit is `(36 - (sum % 36)) % 36`.

/// Alphabet for Mod-36: `0-9` are 0-9, `A-Z` are 10-35.
pub const ALPHABET: &str = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

fn char_value(c: char) -> Option<u32> {
    ALPHABET.find(c).map(|i| i as u32)
}

/// Computes the GSTIN check character for the first 14 characters.
/// Returns `None` when the input is not exactly 14 valid alphabet characters.
pub fn check_digit(first_14: &str) -> Option<char> {
    if first_14.chars().count() != 14 {
        return None;
    }
    let mut factor: u32 = 2;
    let mut sum: u32 = 0;
    for c in first_14.chars().rev() {
        let code = char_value(c)?;
        let product = code * factor;
        sum += product / 36 + product % 36;
        factor = if factor == 2 { 1 } else { 2 };
    }
    let check = (36 - (sum % 36)) % 36;
    ALPHABET.chars().nth(check as usize)
}

/// Returns `true` when a full 15-character GSTIN has a correct check digit.
pub fn is_valid(gstin: &str) -> bool {
    let chars: Vec<char> = gstin.chars().collect();
    if chars.len() != 15 {
        return false;
    }
    let first_14: String = chars[..14].iter().collect();
    match check_digit(&first_14) {
        Some(expected) => expected == chars[14],
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_gstin_check_digits() {
        // Computed with this implementation; verified independently in Python.
        assert_eq!(check_digit("18AAAPL1234C1Z"), Some('D'));
        assert_eq!(check_digit("27ABCDE1234F1Z"), Some('0'));
        assert_eq!(check_digit("18ABCDE1234F1Z"), Some('Z'));
        assert!(is_valid("18AAAPL1234C1ZD"));
        assert!(!is_valid("18AAAPL1234C1ZE"));
    }
}
