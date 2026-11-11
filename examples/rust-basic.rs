//! Basic usage of the indycheck core crate.
//!
//! Run with: `cargo run --example rust-basic -p indycheck`

use indycheck::{
    detect, format_mobile, mask_aadhaar, validate_aadhaar, validate_gstin, validate_many,
    validate_mobile, validate_pan,
};

fn main() {
    println!("PAN: {:?}", validate_pan("ABCDE1234F"));
    println!("Aadhaar: {:?}", validate_aadhaar("234567890124"));
    println!("GSTIN: {:?}", validate_gstin("18AAAPL1234C1ZD"));
    println!("Mobile: {:?}", validate_mobile("+91 98765 43210"));
    println!("format_mobile: {:?}", format_mobile("+91 98765 43210"));
    println!("mask_aadhaar: {}", mask_aadhaar("234567890124"));
    println!("detect GSTIN: {}", detect("18AAAPL1234C1ZD"));
    println!("detect UPI: {}", detect("dus@okaxis"));

    let batch = vec![
        "ABCDE1234F".to_string(),
        "234567890125".to_string(),
        "9876543210".to_string(),
    ];
    for result in validate_many(&batch) {
        println!("batch: valid={} code={} en={}", result.valid, result.code, result.reason_en);
    }
}
