//! Validation options: lets callers control strictness and normalisation.
//!
//! The simple `validate_*` functions all use `Options::default()`, which
//! preserves their documented behaviour exactly:
//!
//! * `strict: true` — enforce every rule, including first-digit rules and
//!   checksums. With `strict: false` (lenient), first-digit and checksum
//!   checks are skipped: the validator then checks the format only.
//! * `allow_spaces_hyphens: true` — spaces and hyphens inside the input are
//!   stripped before validation. With `false`, any space or hyphen is an
//!   `INVALID_FORMAT` error.
//! * `normalise_plus91: true` — a mobile may carry a `+91` / `91` / `0`
//!   prefix, which is stripped. With `false`, only a bare 10-digit number
//!   is accepted.
//! * `uppercase: true` — letter input is upper-cased before validation.
//!   With `false`, a lower-case letter fails the format check instead.

/// Options controlling how a validator treats its input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Options {
    pub strict: bool,
    pub allow_spaces_hyphens: bool,
    pub normalise_plus91: bool,
    pub uppercase: bool,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            strict: true,
            allow_spaces_hyphens: true,
            normalise_plus91: true,
            uppercase: true,
        }
    }
}

impl Options {
    /// Strict validation (the default): every rule enforced.
    pub fn strict() -> Self {
        Self::default()
    }

    /// Lenient validation: format only — first-digit and checksum checks
    /// are skipped. Useful for progressive form validation, where a
    /// half-typed number should not fail on its checksum yet.
    pub fn lenient() -> Self {
        Self {
            strict: false,
            ..Self::default()
        }
    }

    /// Start from the defaults and turn off space/hyphen tolerance.
    pub fn no_spaces_hyphens() -> Self {
        Self {
            allow_spaces_hyphens: false,
            ..Self::default()
        }
    }
}

/// Rejects the input when spaces/hyphens are present but not allowed.
/// Returns `true` when the caller should continue validating.
pub fn spaces_hyphens_ok(input: &str, options: Options) -> bool {
    options.allow_spaces_hyphens
        || (!input.contains(' ') && !input.contains('-') && !input.contains('\t'))
}

/// Applies the `uppercase` option to a trimmed input.
pub fn maybe_uppercase(input: &str, options: Options) -> String {
    let trimmed = input.trim();
    if options.uppercase {
        trimmed.to_ascii_uppercase()
    } else {
        trimmed.to_string()
    }
}

/// Strips spaces and hyphens when the option allows it (callers must have
/// already rejected them when it does not).
pub fn strip_spaces_hyphens(input: &str, options: Options) -> String {
    if options.allow_spaces_hyphens {
        input
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-')
            .collect()
    } else {
        input.to_string()
    }
}
