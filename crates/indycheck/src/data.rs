//! Maintained reference data: Indian GST state codes and common UPI handles.
//!
//! State codes follow the GST state-code list (01-38). Codes 25 and 26
//! both relate to Daman and Diu / Dadra and Nagar Haveli after the 2020
//! merger; both spellings are kept as published by GSTN.
//! UPI handles are the commonly seen bank / app handles. This list is
//! format data only — a handle being listed does not prove that a
//! particular UPI ID exists or is active.

/// (state code, state / UT name) for GSTIN, codes 01-38.
pub const STATE_CODES: &[(&str, &str)] = &[
    ("01", "Jammu and Kashmir"),
    ("02", "Himachal Pradesh"),
    ("03", "Punjab"),
    ("04", "Chandigarh"),
    ("05", "Uttarakhand"),
    ("06", "Haryana"),
    ("07", "Delhi"),
    ("08", "Rajasthan"),
    ("09", "Uttar Pradesh"),
    ("10", "Bihar"),
    ("11", "Sikkim"),
    ("12", "Arunachal Pradesh"),
    ("13", "Nagaland"),
    ("14", "Manipur"),
    ("15", "Mizoram"),
    ("16", "Tripura"),
    ("17", "Meghalaya"),
    ("18", "Assam"),
    ("19", "West Bengal"),
    ("20", "Jharkhand"),
    ("21", "Odisha"),
    ("22", "Chhattisgarh"),
    ("23", "Madhya Pradesh"),
    ("24", "Gujarat"),
    ("25", "Daman and Diu and Dadra and Nagar Haveli"),
    ("26", "Dadra and Nagar Haveli and Daman and Diu"),
    ("27", "Maharashtra"),
    ("28", "Andhra Pradesh"),
    ("29", "Karnataka"),
    ("30", "Goa"),
    ("31", "Lakshadweep"),
    ("32", "Kerala"),
    ("33", "Tamil Nadu"),
    ("34", "Puducherry"),
    ("35", "Andaman and Nicobar Islands"),
    ("36", "Telangana"),
    ("37", "Andhra Pradesh"),
    ("38", "Ladakh"),
];

/// Returns the state / UT name for a 2-digit GST state code, if known.
pub fn state_name(code: &str) -> Option<&'static str> {
    STATE_CODES
        .iter()
        .find(|(c, _)| *c == code)
        .map(|(_, name)| *name)
}

/// Common UPI handles (the part after `@`), lower-case.
pub const UPI_HANDLES: &[&str] = &[
    "paytm",
    "okaxis",
    "okhdfcbank",
    "okicici",
    "oksbi",
    "okbizaxis",
    "ybl",
    "axl",
    "ibl",
    "upi",
    "jio",
    "aubank",
    "freecharge",
    "amazonpay",
    "okbob",
    "okpnb",
    "okciti",
    "barodampay",
    "cnrb",
    "idfcfirst",
    "kvb",
    "rbl",
    "sbi",
    "hdfc",
    "icici",
    "axis",
    "kotak",
    "yesbank",
    "indus",
    "federal",
    "okyes",
    "payzapp",
    "slice",
    "gpay",
    "phonepe",
    "bhim",
];

/// Returns `true` when `handle` (case-insensitive) is a known UPI handle.
pub fn is_known_upi_handle(handle: &str) -> bool {
    let lower = handle.to_ascii_lowercase();
    UPI_HANDLES.contains(&lower.as_str())
}
