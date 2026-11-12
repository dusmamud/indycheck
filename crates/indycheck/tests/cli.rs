//! CLI end-to-end tests: run the built `indycheck` binary as a subprocess.
use std::process::Command;

fn cli() -> Command {
    Command::new(env!("CARGO_BIN_EXE_indycheck"))
}

#[test]
fn version_flag_prints_version() {
    let out = cli().arg("--version").output().unwrap();
    assert!(out.status.success());
    let text = String::from_utf8_lossy(&out.stdout);
    assert!(text.starts_with("indycheck "));
}

#[test]
fn update_reports_installed_version_and_exits_zero() {
    // Needs network for the latest-version check, but must never fail
    // without it: offline it prints guidance and still exits 0.
    let out = cli().arg("update").output().unwrap();
    assert!(out.status.success());
    let text = String::from_utf8_lossy(&out.stdout);
    assert!(text.contains("(installed)"), "{text}");
    assert!(
        text.contains("up to date")
            || text.contains("Update available")
            || text.contains("Could not reach crates.io"),
        "{text}"
    );
}

#[test]
fn update_rejects_extra_args() {
    let out = cli().args(["update", "extra"]).output().unwrap();
    assert_eq!(out.status.code(), Some(2));
}

#[test]
fn unknown_command_exits_two() {
    let out = cli().arg("--bogus").output().unwrap();
    assert_eq!(out.status.code(), Some(2));
}
