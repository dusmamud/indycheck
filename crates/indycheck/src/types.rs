use serde::Serialize;

/// The single result type returned by every validator.
///
/// Validators never panic on bad input: any malformed, empty or
/// non-ASCII input is reported as a `ValidationResult` with
/// `valid == false` and a stable error `code`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub code: String,
    pub reason_en: String,
    pub reason_hi: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parsed: Option<serde_json::Value>,
}

impl ValidationResult {
    pub fn ok(reason_en: &str, reason_hi: &str, parsed: Option<serde_json::Value>) -> Self {
        Self {
            valid: true,
            code: "VALID".to_string(),
            reason_en: reason_en.to_string(),
            reason_hi: reason_hi.to_string(),
            parsed,
        }
    }

    pub fn err(code: &str, reason_en: &str, reason_hi: &str) -> Self {
        Self {
            valid: false,
            code: code.to_string(),
            reason_en: reason_en.to_string(),
            reason_hi: reason_hi.to_string(),
            parsed: None,
        }
    }
}
