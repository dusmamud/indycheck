//! `indycheck` command-line tool — quick clap-free argument parsing.
//!
//! Usage:
//!
//! ```text
//! indycheck validate <type> <value>   # prints a ValidationResult as JSON
//! indycheck detect <value>            # prints {"input": ..., "type": ...}
//! indycheck generate <type> [arg]     # prints {"type": ..., "value": ...}
//! indycheck --version                 # prints "indycheck 0.2.1"
//! indycheck update                    # checks crates.io for a newer version
//! ```
//!
//! `<type>` for validate/detect: pan, aadhaar, gstin, ifsc, upi, mobile,
//! pincode, tan, cin, llpin, voter (or epic), vehicle.
//! `<type>` for generate: pan [entity], aadhaar, gstin [state-code], mobile,
//! vehicle, vehicle-bharat.
//! Generated values are TEST DATA ONLY — syntactically valid, not real IDs.
//!
//! Exit codes: 0 = valid / success, 1 = invalid input, 2 = usage error.

use indycheck::{
    ValidationResult, detect, generate_aadhaar, generate_gstin, generate_mobile, generate_pan,
    generate_vehicle, generate_vehicle_bharat, validate_aadhaar, validate_cin, validate_gstin,
    validate_ifsc, validate_llpin, validate_mobile, validate_pan, validate_pincode, validate_tan,
    validate_upi, validate_vehicle, validate_voter_id,
};
use std::cmp::Ordering;
use std::env;
use std::process::{Command, ExitCode};

fn print_result(result: &ValidationResult) -> ExitCode {
    match serde_json::to_string_pretty(result) {
        Ok(json) => println!("{json}"),
        Err(_) => println!("{{\"valid\":false,\"code\":\"UNKNOWN_TYPE\"}}"),
    }
    if result.valid {
        ExitCode::from(0)
    } else {
        ExitCode::from(1)
    }
}

fn validate(kind: &str, value: &str) -> Result<ValidationResult, String> {
    match kind {
        "pan" => Ok(validate_pan(value)),
        "aadhaar" => Ok(validate_aadhaar(value)),
        "gstin" => Ok(validate_gstin(value)),
        "ifsc" => Ok(validate_ifsc(value)),
        "upi" => Ok(validate_upi(value)),
        "mobile" => Ok(validate_mobile(value)),
        "pincode" => Ok(validate_pincode(value)),
        "tan" => Ok(validate_tan(value)),
        "cin" => Ok(validate_cin(value)),
        "llpin" => Ok(validate_llpin(value)),
        "voter" | "epic" => Ok(validate_voter_id(value)),
        "vehicle" | "registration" | "reg" => Ok(validate_vehicle(value)),
        other => Err(format!("unknown type '{other}'")),
    }
}

fn usage() -> String {
    "Usage:\n  indycheck validate <type> <value>\n  indycheck detect <value>\n  indycheck generate <type> [arg]\n  indycheck --version\n  indycheck update\n\nTypes for validate: pan, aadhaar, gstin, ifsc, upi, mobile, pincode, tan, cin, llpin, voter, vehicle\nTypes for generate: pan [entity-char], aadhaar, gstin [state-code], mobile, vehicle, vehicle-bharat\n\nExit codes: 0 = valid/success, 1 = invalid input, 2 = usage error."
        .to_string()
}

/// Compare two dotted versions ("0.2.1") numerically, segment by segment.
fn cmp_versions(a: &str, b: &str) -> Ordering {
    let parse = |v: &str| {
        v.split('.')
            .map(|s| s.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    parse(a).cmp(&parse(b))
}

/// Latest indycheck version on crates.io, or `None` when it cannot be
/// reached. The CLI deliberately has no HTTP/TLS dependency of its own, so
/// this shells out to `curl` (10s timeout), falling back to `cargo search`.
/// Either tool missing (or offline) just means "unknown", never an error.
fn latest_version() -> Option<String> {
    // Route 1: crates.io API via curl.
    if let Ok(output) = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "10",
            "https://crates.io/api/v1/crates/indycheck",
        ])
        .output()
        .map(|o| o.stdout)
    {
        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output) {
            if let Some(v) = json
                .get("crate")
                .and_then(|c| c.get("max_version"))
                .and_then(|v| v.as_str())
            {
                return Some(v.to_string());
            }
        }
    }
    // Route 2: `cargo search` output looks like: indycheck = "0.2.1" # ...
    if let Ok(output) = Command::new("cargo")
        .args(["search", "indycheck", "--limit", "1"])
        .output()
    {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if let Some(rest) = line.strip_prefix("indycheck = \"") {
                if let Some(version) = rest.split('"').next() {
                    return Some(version.to_string());
                }
            }
        }
    }
    None
}

fn update() -> ExitCode {
    let installed = env!("CARGO_PKG_VERSION");
    println!("indycheck {installed} (installed)");
    match latest_version() {
        Some(latest) => {
            println!("latest: {latest} (crates.io)");
            match cmp_versions(&latest, installed) {
                Ordering::Greater => {
                    println!("Update available. Run:");
                    println!("  cargo install indycheck --force");
                }
                _ => println!("You're up to date."),
            }
        }
        None => {
            println!(
                "Could not reach crates.io to check for updates (no network, curl, or cargo)."
            );
            println!("To update anyway, run:");
            println!("  cargo install indycheck --force");
        }
    }
    ExitCode::from(0)
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let Some(command) = args.first() else {
        eprintln!("{}", usage());
        return ExitCode::from(2);
    };
    match command.as_str() {
        "validate" => {
            if args.len() != 3 {
                eprintln!("validate needs <type> and <value>\n{}", usage());
                return ExitCode::from(2);
            }
            match validate(&args[1], &args[2]) {
                Ok(result) => print_result(&result),
                Err(message) => {
                    eprintln!("{message}\n{}", usage());
                    ExitCode::from(2)
                }
            }
        }
        "detect" => {
            if args.len() != 2 {
                eprintln!("detect needs <value>\n{}", usage());
                return ExitCode::from(2);
            }
            let detected = detect(&args[1]);
            println!(
                "{}",
                serde_json::json!({ "input": args[1], "type": detected })
            );
            ExitCode::from(0)
        }
        "generate" => {
            if args.len() < 2 || args.len() > 3 {
                eprintln!(
                    "generate needs <type> and an optional argument\n{}",
                    usage()
                );
                return ExitCode::from(2);
            }
            let kind = args[1].as_str();
            let value = match kind {
                "pan" => {
                    let entity = args.get(2).and_then(|s| s.chars().next()).unwrap_or('P');
                    generate_pan(entity)
                }
                "aadhaar" => generate_aadhaar(),
                "gstin" => {
                    let state = args.get(2).map(String::as_str).unwrap_or("18");
                    generate_gstin(state)
                }
                "mobile" => generate_mobile(),
                "vehicle" => generate_vehicle(),
                "vehicle-bharat" => generate_vehicle_bharat(),
                other => {
                    eprintln!(
                        "cannot generate '{other}' (try pan, aadhaar, gstin, mobile, vehicle, vehicle-bharat)\n{}",
                        usage()
                    );
                    return ExitCode::from(2);
                }
            };
            println!("{}", serde_json::json!({ "type": kind, "value": value }));
            ExitCode::from(0)
        }
        "help" | "--help" | "-h" => {
            println!("{}", usage());
            ExitCode::from(0)
        }
        "version" | "--version" | "-V" => {
            println!("indycheck {}", env!("CARGO_PKG_VERSION"));
            ExitCode::from(0)
        }
        "update" => {
            if args.len() != 1 {
                eprintln!("update takes no arguments\n{}", usage());
                return ExitCode::from(2);
            }
            update()
        }
        other => {
            eprintln!("unknown command '{other}'\n{}", usage());
            ExitCode::from(2)
        }
    }
}
