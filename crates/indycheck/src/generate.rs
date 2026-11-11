//! Mock test-data generators.
//!
//! TEST DATA ONLY — these are syntactically valid, not real issued IDs.
//! Every value produced here passes this library's own validators, but it
//! was never issued by any authority (UIDAI, Income Tax, GSTN, …) and must
//! never be presented as a real person's ID. Use them only in tests,
//! demos and form previews. The generator is intentionally not seeded and
//! not reproducible: each call may return a different value.

use crate::data::state_name;
use crate::luhn36;
use crate::pan::entity_name;
use crate::verhoeff;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// Tiny xorshift PRNG seeded from the clock + a counter. Good enough for
/// test data; not cryptographic and not used for anything security-related.
struct SimpleRng(u64);

impl SimpleRng {
    fn new() -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0x9E3779B97F4A7C15);
        let count = COUNTER.fetch_add(1, Ordering::Relaxed);
        let seed = nanos ^ (count.wrapping_mul(0x2545F4914F6CDD1D)) ^ 0xA0761D6478BD642F;
        Self(if seed == 0 { 0x12345678 } else { seed })
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    fn digit(&mut self) -> char {
        (b'0' + (self.next_u64() % 10) as u8) as char
    }

    fn digit_range(&mut self, low: u8, high: u8) -> char {
        let span = (high - low + 1) as u64;
        (b'0' + low + (self.next_u64() % span) as u8) as char
    }

    fn letter(&mut self) -> char {
        (b'A' + (self.next_u64() % 26) as u8) as char
    }
}

/// Generates a syntactically valid PAN for the given entity character
/// (`P`, `C`, `H`, `F`, `A`, `T`, `B`, `L`, `J` or `G`).
/// An unknown entity character falls back to `P` (Individual).
/// TEST DATA ONLY — not a real issued PAN.
pub fn generate_pan(entity: char) -> String {
    let entity = entity.to_ascii_uppercase();
    let entity = if entity_name(entity).is_some() {
        entity
    } else {
        'P'
    };
    let mut rng = SimpleRng::new();
    let mut pan = String::with_capacity(10);
    for _ in 0..3 {
        pan.push(rng.letter());
    }
    pan.push(entity);
    pan.push(rng.letter());
    for _ in 0..4 {
        pan.push(rng.digit());
    }
    pan.push(rng.letter());
    pan
}

/// Generates a syntactically valid 12-digit Aadhaar number (first digit
/// 2-9, correct Verhoeff check digit).
/// TEST DATA ONLY — not a real issued Aadhaar number.
pub fn generate_aadhaar() -> String {
    let mut rng = SimpleRng::new();
    let mut base = String::with_capacity(11);
    base.push(rng.digit_range(2, 9));
    for _ in 0..10 {
        base.push(rng.digit());
    }
    let check = verhoeff::verify_digit(&base).unwrap_or('0');
    base.push(check);
    base
}

/// Generates a syntactically valid GSTIN for the given 2-digit state code
/// (e.g. `"18"` for Assam). An unknown state code falls back to `"18"`.
/// TEST DATA ONLY — not a real issued GSTIN.
pub fn generate_gstin(state_code: &str) -> String {
    let state_code = if state_name(state_code).is_some() {
        state_code.to_string()
    } else {
        "18".to_string()
    };
    let mut rng = SimpleRng::new();
    let pan = generate_pan('P');
    let entity_char = if rng.next_u64().is_multiple_of(2) {
        '1'
    } else {
        '2'
    };
    let first_14 = format!("{state_code}{pan}{entity_char}Z");
    let check = luhn36::check_digit(&first_14).unwrap_or('0');
    format!("{first_14}{check}")
}

/// Generates a syntactically valid Indian mobile number (10 digits,
/// first digit 6-9). TEST DATA ONLY — not a real person's number.
pub fn generate_mobile() -> String {
    let mut rng = SimpleRng::new();
    let mut mobile = String::with_capacity(10);
    mobile.push(rng.digit_range(6, 9));
    for _ in 0..9 {
        mobile.push(rng.digit());
    }
    mobile
}
