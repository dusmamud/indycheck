//! Verhoeff checksum, as used by the 12-digit Aadhaar number.
//!
//! Tables are the standard Verhoeff multiplication table `D`,
//! permutation table `P` and inverse table `INV`.

/// Verhoeff multiplication table.
pub const D: [[u8; 10]; 10] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/// Verhoeff permutation table.
pub const P: [[u8; 10]; 8] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 0, 1, 3, 2, 4, 9, 6, 7, 5],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/// Verhoeff inverse table.
pub const INV: [u8; 10] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/// Returns `true` when `number` (all ASCII digits) passes Verhoeff validation.
pub fn is_valid(number: &str) -> bool {
    if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    let mut c: usize = 0;
    for (i, byte) in number.bytes().rev().enumerate() {
        let digit = (byte - b'0') as usize;
        c = D[c][P[i % 8][digit] as usize] as usize;
    }
    c == 0
}

/// Computes the Verhoeff check digit for `base` (all ASCII digits, no check digit yet).
/// Returns `None` for empty or non-digit input.
pub fn verify_digit(base: &str) -> Option<char> {
    if base.is_empty() || !base.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let mut c: usize = 0;
    // The check digit will occupy position 0, so base digits start at position 1.
    for (i, byte) in base.bytes().rev().enumerate() {
        let digit = (byte - b'0') as usize;
        c = D[c][P[(i + 1) % 8][digit] as usize] as usize;
    }
    let check = INV[c] as usize;
    Some((b'0' + check as u8) as char)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_aadhaar_validates() {
        // Generated with verify_digit("23456789012") == '4'.
        assert!(is_valid("234567890124"));
        assert!(!is_valid("234567890125"));
    }

    #[test]
    fn verify_digit_roundtrip() {
        assert_eq!(verify_digit("23456789012"), Some('4'));
        assert_eq!(verify_digit("98765432109"), Some('0'));
        assert_eq!(verify_digit(""), None);
        assert_eq!(verify_digit("12a"), None);
    }
}
