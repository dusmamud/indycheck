use indycheck::{
    Options, ValidationResult, detect, format_gstin, format_mobile, format_pan, generate_aadhaar,
    generate_gstin, generate_mobile, generate_pan, mask_aadhaar, mask_mobile, mask_pan,
    validate_aadhaar, validate_aadhaar_with_options, validate_cin, validate_gstin,
    validate_gstin_with_options, validate_ifsc, validate_llpin, validate_many, validate_mobile,
    validate_mobile_with_options, validate_pan, validate_pan_with_options, validate_pincode,
    validate_tan, validate_upi, validate_vehicle, validate_voter_id,
};
use serde::Deserialize;

#[derive(Debug, Deserialize, Default)]
struct VectorOptions {
    strict: Option<bool>,
    allow_spaces_hyphens: Option<bool>,
    normalise_plus91: Option<bool>,
    uppercase: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Vector {
    input: String,
    #[serde(rename = "type")]
    kind: String,
    valid: bool,
    code: String,
    #[serde(default)]
    detect: bool,
    #[serde(default)]
    options: Option<VectorOptions>,
    #[serde(default)]
    generator: Option<String>,
}

fn options_from(vector: &Vector) -> Options {
    let mut options = Options::default();
    if let Some(o) = &vector.options {
        if let Some(v) = o.strict {
            options.strict = v;
        }
        if let Some(v) = o.allow_spaces_hyphens {
            options.allow_spaces_hyphens = v;
        }
        if let Some(v) = o.normalise_plus91 {
            options.normalise_plus91 = v;
        }
        if let Some(v) = o.uppercase {
            options.uppercase = v;
        }
    }
    options
}

fn load_vectors() -> Vec<Vector> {
    let text = include_str!("../../../shared/test-vectors.json");
    serde_json::from_str(text).expect("test vectors must parse as JSON")
}

fn validate_by_type(kind: &str, input: &str) -> ValidationResult {
    validate_by_type_with_options(kind, input, Options::default())
}

fn validate_by_type_with_options(kind: &str, input: &str, options: Options) -> ValidationResult {
    match kind {
        "pan" => validate_pan_with_options(input, options),
        "aadhaar" => validate_aadhaar_with_options(input, options),
        "gstin" => validate_gstin_with_options(input, options),
        "ifsc" => validate_ifsc(input),
        "upi" => validate_upi(input),
        "mobile" => validate_mobile_with_options(input, options),
        "pincode" => validate_pincode(input),
        "tan" => validate_tan(input),
        "cin" => validate_cin(input),
        "llpin" => validate_llpin(input),
        "voter" => validate_voter_id(input),
        "vehicle" => validate_vehicle(input),
        other => panic!("unknown vector type {other}"),
    }
}

/// Generates a value of the requested kind (input carries the generator
/// argument: PAN entity char, GSTIN state code, or empty) and validates it.
fn generate_and_validate(kind: &str, input: &str) -> ValidationResult {
    match kind {
        "pan" => {
            let entity = input.chars().next().unwrap_or('P');
            validate_pan(&generate_pan(entity))
        }
        "aadhaar" => validate_aadhaar(&generate_aadhaar()),
        "gstin" => validate_gstin(&generate_gstin(input)),
        "mobile" => validate_mobile(&generate_mobile()),
        other => panic!("unknown generator type {other}"),
    }
}

#[test]
fn all_test_vectors() {
    let vectors = load_vectors();
    assert!(
        vectors.len() >= 150,
        "need 150+ vectors, got {}",
        vectors.len()
    );
    let mut failures = Vec::new();
    for v in &vectors {
        // Generator entries: generate fresh values (3x, randomness) and
        // validate them; options entries use validate_*_with_options.
        let r = if v.generator.is_some() {
            let mut last = generate_and_validate(&v.kind, &v.input);
            for _ in 0..2 {
                last = generate_and_validate(&v.kind, &v.input);
                if !last.valid {
                    break;
                }
            }
            last
        } else if v.options.is_some() {
            validate_by_type_with_options(&v.kind, &v.input, options_from(v))
        } else {
            validate_by_type(&v.kind, &v.input)
        };
        if r.valid != v.valid || r.code != v.code {
            failures.push(format!(
                "{} {:?}: expected valid={} code={}, got valid={} code={}",
                v.kind, v.input, v.valid, v.code, r.valid, r.code
            ));
        }
        if v.detect && detect(&v.input) != v.kind {
            failures.push(format!(
                "detect {:?}: expected {}, got {}",
                v.input,
                v.kind,
                detect(&v.input)
            ));
        }
        if r.valid {
            assert!(!r.reason_hi.is_empty(), "reason_hi empty for {:?}", v.input);
            assert!(!r.reason_en.is_empty(), "reason_en empty for {:?}", v.input);
        }
    }
    assert!(
        failures.is_empty(),
        "vector failures:\n{}",
        failures.join("\n")
    );
}

#[test]
fn vectors_cover_all_types() {
    let vectors = load_vectors();
    for kind in [
        "pan", "aadhaar", "gstin", "ifsc", "upi", "mobile", "pincode",
    ] {
        assert!(
            vectors.iter().any(|v| v.kind == kind && v.valid),
            "no valid vector for {kind}"
        );
        assert!(
            vectors.iter().any(|v| v.kind == kind && !v.valid),
            "no invalid vector for {kind}"
        );
    }
}

// ---- PAN ----
#[test]
fn pan_valid_individual() {
    // ABCDE1234F is format-valid (entity "Unknown", 4th char D); a PAN
    // whose 4th char is P parses as entity Individual.
    assert!(validate_pan("ABCDE1234F").valid);
    let r = validate_pan("ABCPD1234F");
    assert!(r.valid && r.code == "VALID");
    let parsed = r.parsed.unwrap();
    assert_eq!(parsed["entity"], "Individual");
    assert_eq!(parsed["entity_code"], "P");
}

#[test]
fn pan_valid_company() {
    let r = validate_pan("XYZCP1234A");
    assert!(r.valid);
    assert_eq!(r.parsed.unwrap()["entity"], "Company");
}

#[test]
fn pan_lowercase_accepted() {
    assert!(validate_pan("abcde1234f").valid);
}

#[test]
fn pan_unknown_entity_is_format_valid() {
    // 4th char X is not in the published entity list, but the PAN is still
    // format-valid (entity reported as "Unknown") — see pan.rs.
    let r = validate_pan("ABCDX1234F");
    assert!(r.valid);
    assert_eq!(r.parsed.unwrap()["entity"], "Unknown");
}

#[test]
fn pan_invalid_format() {
    let r = validate_pan("ABCDE12345");
    assert!(!r.valid && r.code == "INVALID_FORMAT");
}

#[test]
fn pan_invalid_length() {
    assert_eq!(validate_pan("ABCDE1234").code, "INVALID_LENGTH");
}

#[test]
fn pan_empty() {
    assert_eq!(validate_pan("").code, "EMPTY");
    assert_eq!(validate_pan("   ").code, "EMPTY");
}

// ---- Aadhaar ----
#[test]
fn aadhaar_valid() {
    assert!(validate_aadhaar("234567890124").valid);
}

#[test]
fn aadhaar_valid_with_spaces() {
    assert!(validate_aadhaar("2345 6789 0124").valid);
}

#[test]
fn aadhaar_invalid_checksum() {
    let r = validate_aadhaar("234567890125");
    assert!(!r.valid && r.code == "INVALID_CHECKSUM");
}

#[test]
fn aadhaar_invalid_first_digit() {
    assert_eq!(validate_aadhaar("123456789017").code, "INVALID_FIRST_DIGIT");
}

#[test]
fn aadhaar_invalid_length() {
    assert_eq!(validate_aadhaar("23456789012").code, "INVALID_LENGTH");
}

#[test]
fn mask_aadhaar_valid() {
    assert_eq!(mask_aadhaar("234567890124"), "XXXX XXXX 0124");
}

#[test]
fn mask_aadhaar_invalid_returns_empty() {
    assert_eq!(mask_aadhaar("123"), "");
    assert_eq!(mask_aadhaar("abcdefghijkl"), "");
    assert_eq!(mask_aadhaar(""), "");
}

// ---- GSTIN ----
#[test]
fn gstin_valid_assam() {
    let r = validate_gstin("18AAAPL1234C1ZD");
    assert!(r.valid && r.code == "VALID");
    let p = r.parsed.unwrap();
    assert_eq!(p["state"], "Assam");
    assert_eq!(p["state_code"], "18");
    assert_eq!(p["pan"], "AAAPL1234C");
}

#[test]
fn gstin_valid_maharashtra() {
    assert!(validate_gstin("27ABCDE1234F1Z0").valid);
}

#[test]
fn gstin_invalid_state_code() {
    assert_eq!(validate_gstin("99AAAPL1234C1ZD").code, "INVALID_STATE_CODE");
}

#[test]
fn gstin_invalid_checksum() {
    assert_eq!(validate_gstin("18AAAPL1234C1ZE").code, "INVALID_CHECKSUM");
}

#[test]
fn gstin_missing_z() {
    assert_eq!(validate_gstin("18AAAPL1234C1AD").code, "INVALID_FORMAT");
}

#[test]
fn gstin_lowercase_accepted() {
    assert!(validate_gstin("18aaapl1234c1zd").valid);
}

// ---- IFSC ----
#[test]
fn ifsc_valid() {
    let r = validate_ifsc("SBIN0000123");
    assert!(r.valid);
    let p = r.parsed.unwrap();
    assert_eq!(p["bank_code"], "SBIN");
    assert_eq!(p["branch_code"], "000123");
}

#[test]
fn ifsc_fifth_char_must_be_zero() {
    assert_eq!(validate_ifsc("SBIN1000123").code, "INVALID_FORMAT");
}

#[test]
fn ifsc_invalid_length() {
    assert_eq!(validate_ifsc("SBIN000012").code, "INVALID_LENGTH");
}

// ---- UPI ----
#[test]
fn upi_valid() {
    let r = validate_upi("dus@okaxis");
    assert!(r.valid);
    assert_eq!(r.parsed.unwrap()["handle"], "okaxis");
}

#[test]
fn upi_invalid_handle() {
    assert_eq!(validate_upi("name@unknownhandle").code, "INVALID_HANDLE");
}

#[test]
fn upi_missing_at() {
    assert_eq!(validate_upi("name").code, "INVALID_FORMAT");
}

#[test]
fn upi_name_too_short() {
    assert_eq!(validate_upi("a@okaxis").code, "INVALID_FORMAT");
}

// ---- Mobile ----
#[test]
fn mobile_valid_plain() {
    let r = validate_mobile("9876543210");
    assert!(r.valid);
    assert_eq!(r.parsed.unwrap()["normalized"], "9876543210");
}

#[test]
fn mobile_normalises_country_code() {
    assert_eq!(
        format_mobile("+91 98765 43210"),
        Some("9876543210".to_string())
    );
    assert_eq!(
        format_mobile("919876543210"),
        Some("9876543210".to_string())
    );
    assert_eq!(format_mobile("09876543210"), Some("9876543210".to_string()));
    assert_eq!(format_mobile("98765-43210"), Some("9876543210".to_string()));
}

#[test]
fn mobile_invalid_first_digit() {
    assert_eq!(validate_mobile("5876543210").code, "INVALID_FIRST_DIGIT");
}

#[test]
fn format_mobile_none_on_invalid() {
    assert_eq!(format_mobile("5876543210"), None);
    assert_eq!(format_mobile("987654321"), None);
    assert_eq!(format_mobile(""), None);
}

// ---- PIN code ----
#[test]
fn pincode_valid() {
    let r = validate_pincode("781001");
    assert!(r.valid);
    assert_eq!(r.parsed.unwrap()["pincode"], "781001");
}

#[test]
fn pincode_first_digit_zero_invalid() {
    assert_eq!(validate_pincode("081001").code, "INVALID_FIRST_DIGIT");
}

#[test]
fn pincode_invalid_length() {
    assert_eq!(validate_pincode("78100").code, "INVALID_LENGTH");
}

// ---- detect ----
#[test]
fn detect_all_types() {
    assert_eq!(detect("ABCDE1234F"), "pan");
    assert_eq!(detect("234567890124"), "aadhaar");
    assert_eq!(detect("18AAAPL1234C1ZD"), "gstin");
    assert_eq!(detect("SBIN0000123"), "ifsc");
    assert_eq!(detect("dus@okaxis"), "upi");
    assert_eq!(detect("9876543210"), "mobile");
    assert_eq!(detect("781001"), "pincode");
    assert_eq!(detect("AAAA12345B"), "tan");
    assert_eq!(detect("L12345MH2020PLC123456"), "cin");
    assert_eq!(detect("AAA1234"), "llpin");
    assert_eq!(detect("ABC1234567"), "voter");
    assert_eq!(detect("DL01AB1234"), "vehicle");
    assert_eq!(detect("hello"), "unknown");
    assert_eq!(detect(""), "unknown");
    // GSTIN before PAN (15 chars), Aadhaar before mobile (12 digits).
    assert_eq!(detect("27ABCDE1234F1Z0"), "gstin");
    assert_eq!(detect("+91 98765 43210"), "mobile");
}

// ---- validate_many ----
#[test]
fn validate_many_batch() {
    let inputs = vec![
        "ABCDE1234F".to_string(),
        "234567890124".to_string(),
        "not-an-id".to_string(),
        "9876543210".to_string(),
    ];
    let results = validate_many(&inputs);
    assert_eq!(results.len(), 4);
    assert!(results[0].valid);
    assert!(results[1].valid);
    assert_eq!(results[2].code, "UNKNOWN_TYPE");
    assert!(results[3].valid);
}

#[test]
fn validate_many_empty_input() {
    assert!(validate_many(&[]).is_empty());
}

// ---- Never panics on bad input ----
#[test]
fn never_panics_on_weird_input() {
    for input in [
        "",
        " ",
        "😀😀😀",
        "ABCDE1234F\n",
        "\t",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "@@@",
        "91",
        "0000000000000000000000",
        "SBIN0000123\u{1F600}",
    ] {
        let _ = validate_pan(input);
        let _ = validate_aadhaar(input);
        let _ = validate_gstin(input);
        let _ = validate_ifsc(input);
        let _ = validate_upi(input);
        let _ = validate_mobile(input);
        let _ = validate_pincode(input);
        let _ = detect(input);
        let _ = mask_aadhaar(input);
        let _ = format_mobile(input);
    }
    let inputs = vec!["😀".to_string(), String::new()];
    let _ = validate_many(&inputs);
}

// ---- TAN / CIN / LLPIN / Voter / Vehicle ----
#[test]
fn tan_valid_and_invalid() {
    assert!(validate_tan("AAAA12345B").valid);
    assert!(validate_tan("delh12345a").valid);
    assert_eq!(validate_tan("AAAA1234B").code, "INVALID_LENGTH");
    assert_eq!(validate_tan("123412345B").code, "INVALID_FORMAT");
}

#[test]
fn cin_valid_and_invalid() {
    let r = validate_cin("L12345MH2020PLC123456");
    assert!(r.valid);
    let p = r.parsed.unwrap();
    assert_eq!(p["listing"], "Listed");
    assert_eq!(p["state_code"], "MH");
    assert_eq!(p["year"], "2020");
    assert_eq!(validate_cin("X12345MH2020PLC123456").code, "INVALID_FORMAT");
    assert_eq!(validate_cin("L12345MH2020PLC12345").code, "INVALID_LENGTH");
}

#[test]
fn llpin_valid_and_invalid() {
    assert!(validate_llpin("AAA1234").valid);
    assert_eq!(validate_llpin("AA12345").code, "INVALID_FORMAT");
    assert_eq!(validate_llpin("ABC123").code, "INVALID_LENGTH");
}

#[test]
fn voter_valid_and_invalid() {
    let r = validate_voter_id("ABC1234567");
    assert!(r.valid);
    assert_eq!(r.parsed.unwrap()["epic"], "ABC1234567");
    assert_eq!(validate_voter_id("AB12345678").code, "INVALID_FORMAT");
    assert_eq!(validate_voter_id("ABC123456").code, "INVALID_LENGTH");
}

#[test]
fn vehicle_valid_and_invalid() {
    let r = validate_vehicle("DL01AB1234");
    assert!(r.valid);
    let p = r.parsed.unwrap();
    assert_eq!(p["state_code"], "DL");
    assert_eq!(p["district"], "01");
    assert_eq!(p["series"], "AB");
    assert_eq!(p["number"], "1234");
    assert!(validate_vehicle("DL 01 AB 1234").valid);
    assert!(validate_vehicle("DL01A1234").valid);
    assert_eq!(validate_vehicle("DL01ABCD1234").code, "INVALID_LENGTH");
    assert_eq!(validate_vehicle("DL01ABC123").code, "INVALID_FORMAT");
    assert_eq!(validate_vehicle("DL01AB12345").code, "INVALID_LENGTH");
}

// ---- format_* / mask_* ----
#[test]
fn format_and_mask_helpers() {
    assert_eq!(format_pan("abcde1234f"), Some("ABCDE1234F".to_string()));
    assert_eq!(format_pan("ABCDE12345"), None);
    assert_eq!(mask_pan("ABCDE1234F"), "ABCDE****F");
    assert_eq!(mask_pan("ABCDE12345"), "");
    assert_eq!(
        format_gstin("18aaapl1234c1zd"),
        Some("18AAAPL1234C1ZD".to_string())
    );
    assert_eq!(
        format_gstin("18AAAPL1234C1ZE"),
        Some("18AAAPL1234C1ZE".to_string())
    );
    assert_eq!(format_gstin("18AAAPL1234C1"), None);
    assert_eq!(mask_mobile("9876543210"), "******3210");
    assert_eq!(mask_mobile("+91 98765 43210"), "******3210");
    assert_eq!(mask_mobile("123"), "");
}

// ---- Options ----
#[test]
fn options_lenient_skips_checksum_and_first_digit() {
    let lenient = Options::lenient();
    assert!(validate_aadhaar_with_options("234567890125", lenient).valid);
    assert!(validate_aadhaar_with_options("123456789017", lenient).valid);
    assert!(validate_gstin_with_options("18AAAPL1234C1ZE", lenient).valid);
    assert!(validate_mobile_with_options("5876543210", lenient).valid);
}

#[test]
fn options_uppercase_and_spaces() {
    let no_upper = Options {
        uppercase: false,
        ..Options::default()
    };
    assert!(!validate_pan_with_options("abcde1234f", no_upper).valid);
    assert!(validate_pan_with_options("ABCDE1234F", no_upper).valid);
    let no_spaces = Options::no_spaces_hyphens();
    assert!(!validate_mobile_with_options("98765 43210", no_spaces).valid);
    let no_plus91 = Options {
        normalise_plus91: false,
        ..Options::default()
    };
    assert!(!validate_mobile_with_options("+91 98765 43210", no_plus91).valid);
    assert!(validate_mobile_with_options("9876543210", no_plus91).valid);
}

// ---- Generators ----
#[test]
fn generators_produce_valid_values() {
    for _ in 0..5 {
        assert!(validate_pan(&generate_pan('P')).valid);
        assert!(validate_pan(&generate_pan('C')).valid);
        assert!(validate_pan(&generate_pan('X')).valid); // falls back to P
        assert!(validate_aadhaar(&generate_aadhaar()).valid);
        assert!(validate_gstin(&generate_gstin("18")).valid);
        assert!(validate_gstin(&generate_gstin("27")).valid);
        assert!(validate_gstin(&generate_gstin("99")).valid); // falls back to 18
        assert!(validate_mobile(&generate_mobile()).valid);
    }
}

#[test]
fn generators_are_not_constant() {
    let pans: Vec<String> = (0..5).map(|_| generate_pan('P')).collect();
    let mobiles: Vec<String> = (0..5).map(|_| generate_mobile()).collect();
    assert!(pans.iter().collect::<std::collections::HashSet<_>>().len() > 1);
    assert!(
        mobiles
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            > 1
    );
}

// ---- validate_many with new types ----
#[test]
fn validate_many_new_types() {
    let inputs = vec![
        "AAAA12345B".to_string(),
        "L12345MH2020PLC123456".to_string(),
        "DL01AB1234".to_string(),
        "ABC1234567".to_string(),
        "AAA1234".to_string(),
    ];
    let results = validate_many(&inputs);
    assert_eq!(results.len(), 5);
    assert!(results.iter().all(|r| r.valid));
}
