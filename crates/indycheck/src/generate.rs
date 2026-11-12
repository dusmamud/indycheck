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

    /// A letter excluding `I` and `O` (they look like digits on a plate).
    fn letter_no_io(&mut self) -> char {
        const LETTERS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
        LETTERS[(self.next_u64() % 24) as usize] as char
    }

    fn number_range(&mut self, low: u64, high: u64) -> u64 {
        low + (self.next_u64() % (high - low + 1))
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
    let entity_char = if rng.next_u64() % 2 == 0 { '1' } else { '2' };
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

/// Common state codes, so generated numbers look like real plates instead
/// of random letter pairs. The validator does not check state codes
/// against a list — this is only for realism.
const VEHICLE_STATE_CODES: &[&str] = &[
    "DL", "MH", "UP", "KA", "TN", "GJ", "RJ", "WB", "KL", "PB", "HR", "AP", "TS", "MP", "BR",
];

/// Generates a syntactically valid state-format vehicle registration
/// number (`DL01AB1234`: state code + district + series + number).
/// TEST DATA ONLY — not a real issued registration number.
pub fn generate_vehicle() -> String {
    let mut rng = SimpleRng::new();
    let state = VEHICLE_STATE_CODES[(rng.next_u64() % VEHICLE_STATE_CODES.len() as u64) as usize];
    let district = rng.number_range(1, 99);
    let series_len = if rng.next_u64() % 2 == 0 { 1 } else { 2 };
    let mut series = String::with_capacity(2);
    for _ in 0..series_len {
        series.push(rng.letter_no_io());
    }
    let number = rng.number_range(1, 9999);
    format!("{state}{district:02}{series}{number:04}")
}

/// Generates a syntactically valid Bharat (BH) series vehicle number
/// (`22BH1234AA`: year 21-26, `BH`, number 0001-9999, suffix without
/// `I`/`O`). TEST DATA ONLY — not a real issued registration number.
pub fn generate_vehicle_bharat() -> String {
    let mut rng = SimpleRng::new();
    let year = rng.number_range(21, 26);
    let number = rng.number_range(1, 9999);
    let mut suffix = String::with_capacity(2);
    for _ in 0..2 {
        suffix.push(rng.letter_no_io());
    }
    format!("{year:02}BH{number:04}{suffix}")
}
