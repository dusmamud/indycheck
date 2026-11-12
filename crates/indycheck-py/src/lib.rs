//! Python bindings for indycheck — thin PyO3 wrappers over the Rust core.
//!
//! All validation logic lives in the `indycheck` crate; this crate only
//! converts results to Python dicts. Build with `maturin develop` /
//! `maturin build` (from this directory).
//!
//! NOTE: PyO3 0.30 migration — `ToPyObject::to_object` and the `PyObject`
//! type alias are gone; use `IntoPyObjectExt::into_bound_py_any` and
//! `Py<PyAny>` instead. `#[pyclass]` no longer derives `FromPyObject`
//! by default — `Options` opts back in with `#[pyclass(from_py_object)]`.
//! `PyList::empty` / `PyDict::new` replace `empty_bound` / `new_bound`;
//! `Bound::cast` replaces `downcast`.
#![allow(clippy::useless_conversion)]

use ::indycheck::{
    Options as CoreOptions, ValidationResult, detect as core_detect,
    format_gstin as core_format_gstin, format_mobile as core_format_mobile,
    format_mobile_with_options as core_format_mobile_with_options, format_pan as core_format_pan,
    generate_aadhaar as core_generate_aadhaar, generate_gstin as core_generate_gstin,
    generate_mobile as core_generate_mobile, generate_pan as core_generate_pan,
    generate_vehicle as core_generate_vehicle,
    generate_vehicle_bharat as core_generate_vehicle_bharat, mask_aadhaar as core_mask_aadhaar,
    mask_mobile as core_mask_mobile, mask_pan as core_mask_pan,
    validate_aadhaar as core_validate_aadhaar,
    validate_aadhaar_with_options as core_validate_aadhaar_with_options,
    validate_cin as core_validate_cin, validate_gstin as core_validate_gstin,
    validate_gstin_with_options as core_validate_gstin_with_options,
    validate_ifsc as core_validate_ifsc, validate_llpin as core_validate_llpin,
    validate_many as core_validate_many, validate_mobile as core_validate_mobile,
    validate_mobile_with_options as core_validate_mobile_with_options,
    validate_pan as core_validate_pan, validate_pan_with_options as core_validate_pan_with_options,
    validate_pincode as core_validate_pincode, validate_tan as core_validate_tan,
    validate_upi as core_validate_upi, validate_vehicle as core_validate_vehicle,
    validate_voter_id as core_validate_voter_id,
};
use pyo3::IntoPyObjectExt;
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};

/// Convert an infallible Rust primitive (`bool`, `i64`, `u64`, `f64`,
/// `String`, `&str`) into an owned Python object.
fn to_py<'py>(py: Python<'py>, value: impl pyo3::IntoPyObject<'py>) -> Py<PyAny> {
    value
        .into_bound_py_any(py)
        .expect("primitive to Python conversion is infallible")
        .unbind()
}

fn value_to_py(py: Python<'_>, value: &serde_json::Value) -> Py<PyAny> {
    match value {
        serde_json::Value::Null => py.None(),
        serde_json::Value::Bool(b) => to_py(py, *b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                to_py(py, i)
            } else if let Some(u) = n.as_u64() {
                to_py(py, u)
            } else if let Some(f) = n.as_f64() {
                to_py(py, f)
            } else {
                py.None()
            }
        }
        serde_json::Value::String(s) => to_py(py, s),
        serde_json::Value::Array(items) => {
            let list = PyList::empty(py);
            for item in items {
                list.append(value_to_py(py, item)).expect("list append");
            }
            list.into_any().unbind()
        }
        serde_json::Value::Object(map) => {
            let dict = PyDict::new(py);
            for (k, v) in map {
                dict.set_item(k, value_to_py(py, v)).expect("dict set");
            }
            dict.into_any().unbind()
        }
    }
}

fn result_to_dict(py: Python<'_>, result: &ValidationResult) -> Py<PyAny> {
    let dict = PyDict::new(py);
    dict.set_item("valid", result.valid).expect("dict set");
    dict.set_item("code", &result.code).expect("dict set");
    dict.set_item("reason_en", &result.reason_en)
        .expect("dict set");
    dict.set_item("reason_hi", &result.reason_hi)
        .expect("dict set");
    match &result.parsed {
        Some(parsed) => {
            dict.set_item("parsed", value_to_py(py, parsed))
                .expect("dict set");
        }
        None => {
            dict.set_item("parsed", py.None()).expect("dict set");
        }
    }
    dict.into_any().unbind()
}

/// The `INVALID_TYPE` result for non-string input. The Rust core takes
/// `&str`, so it has no equivalent — this is the Python (and JS) layer's
/// answer, with the same wording as the pure-Python mirror's
/// `_invalid_type()`. Validators must never throw on bad input.
fn invalid_type_result() -> ValidationResult {
    ValidationResult::err(
        "INVALID_TYPE",
        "Input must be a string.",
        "Input string hona chahiye.",
    )
}

/// Extract a Rust `String` from any Python value. Returns `None` for
/// non-strings (`None`, `int`, `bytes`, ...) instead of raising `TypeError`.
fn extract_string(input: &Bound<'_, PyAny>) -> Option<String> {
    input.extract::<String>().ok()
}

/// Validation options, mirroring the Rust core's `Options` and the JS
/// `Options` interface: `strict`, `allow_spaces_hyphens`,
/// `normalise_plus91`, `uppercase` — all default to `True`.
#[pyclass(from_py_object)]
#[derive(Debug, Clone, Copy)]
struct Options {
    #[pyo3(get, set)]
    strict: bool,
    #[pyo3(get, set)]
    allow_spaces_hyphens: bool,
    #[pyo3(get, set)]
    normalise_plus91: bool,
    #[pyo3(get, set)]
    uppercase: bool,
}

#[pymethods]
impl Options {
    #[new]
    #[pyo3(signature = (strict=true, allow_spaces_hyphens=true, normalise_plus91=true, uppercase=true))]
    fn new(
        strict: bool,
        allow_spaces_hyphens: bool,
        normalise_plus91: bool,
        uppercase: bool,
    ) -> Self {
        Self {
            strict,
            allow_spaces_hyphens,
            normalise_plus91,
            uppercase,
        }
    }

    fn __repr__(&self) -> String {
        format!(
            "Options(strict={}, allow_spaces_hyphens={}, normalise_plus91={}, uppercase={})",
            self.strict, self.allow_spaces_hyphens, self.normalise_plus91, self.uppercase
        )
    }
}

impl From<Options> for CoreOptions {
    fn from(o: Options) -> Self {
        CoreOptions {
            strict: o.strict,
            allow_spaces_hyphens: o.allow_spaces_hyphens,
            normalise_plus91: o.normalise_plus91,
            uppercase: o.uppercase,
        }
    }
}

/// Accept `None` (defaults), an `Options` instance, or a `dict` with any
/// subset of the option keys. Anything else is a programming error and
/// raises `TypeError` — unlike the validated input, options are not data.
fn options_from_py(obj: Option<&Bound<'_, PyAny>>) -> PyResult<CoreOptions> {
    let Some(obj) = obj else {
        return Ok(CoreOptions::default());
    };
    if obj.is_none() {
        return Ok(CoreOptions::default());
    }
    if let Ok(opts) = obj.extract::<Options>() {
        return Ok(opts.into());
    }
    if let Ok(dict) = obj.cast::<PyDict>() {
        let get = |key: &str| -> PyResult<bool> {
            match dict.get_item(key)? {
                Some(v) => match v.extract::<bool>() {
                    Ok(b) => Ok(b),
                    Err(_) => Err(PyErr::new::<pyo3::exceptions::PyTypeError, _>(format!(
                        "Options['{key}'] must be a bool"
                    ))),
                },
                None => Ok(true),
            }
        };
        return Ok(CoreOptions {
            strict: get("strict")?,
            allow_spaces_hyphens: get("allow_spaces_hyphens")?,
            normalise_plus91: get("normalise_plus91")?,
            uppercase: get("uppercase")?,
        });
    }
    Err(PyErr::new::<pyo3::exceptions::PyTypeError, _>(
        "options must be an Options instance, a dict, or None",
    ))
}

#[pyfunction]
fn default_options() -> Options {
    Options {
        strict: true,
        allow_spaces_hyphens: true,
        normalise_plus91: true,
        uppercase: true,
    }
}

#[pyfunction]
fn lenient_options() -> Options {
    Options {
        strict: false,
        allow_spaces_hyphens: true,
        normalise_plus91: true,
        uppercase: true,
    }
}

#[pyfunction]
fn no_spaces_hyphens_options() -> Options {
    Options {
        strict: true,
        allow_spaces_hyphens: false,
        normalise_plus91: true,
        uppercase: true,
    }
}

macro_rules! py_validate_with_options {
    ($name:ident, $func:ident) => {
        #[pyfunction]
        #[pyo3(signature = (input, options=None))]
        fn $name(
            py: Python<'_>,
            input: &Bound<'_, PyAny>,
            options: Option<&Bound<'_, PyAny>>,
        ) -> PyResult<Py<PyAny>> {
            let opts = options_from_py(options)?;
            Ok(match extract_string(input) {
                Some(s) => result_to_dict(py, &$func(&s, opts)),
                None => result_to_dict(py, &invalid_type_result()),
            })
        }
    };
}

py_validate_with_options!(validate_pan_with_options, core_validate_pan_with_options);
py_validate_with_options!(
    validate_aadhaar_with_options,
    core_validate_aadhaar_with_options
);
py_validate_with_options!(
    validate_gstin_with_options,
    core_validate_gstin_with_options
);
py_validate_with_options!(
    validate_mobile_with_options,
    core_validate_mobile_with_options
);

#[pyfunction]
#[pyo3(signature = (input, options=None))]
fn format_mobile_with_options(
    _py: Python<'_>,
    input: &Bound<'_, PyAny>,
    options: Option<&Bound<'_, PyAny>>,
) -> PyResult<Option<String>> {
    let opts = options_from_py(options)?;
    Ok(match extract_string(input) {
        Some(s) => core_format_mobile_with_options(&s, opts),
        None => None,
    })
}

macro_rules! py_validate {
    ($name:ident, $func:ident) => {
        #[pyfunction]
        fn $name(py: Python<'_>, input: &Bound<'_, PyAny>) -> Py<PyAny> {
            match extract_string(input) {
                Some(s) => result_to_dict(py, &$func(&s)),
                None => result_to_dict(py, &invalid_type_result()),
            }
        }
    };
}

py_validate!(validate_pan, core_validate_pan);
py_validate!(validate_aadhaar, core_validate_aadhaar);
py_validate!(validate_gstin, core_validate_gstin);
py_validate!(validate_ifsc, core_validate_ifsc);
py_validate!(validate_upi, core_validate_upi);
py_validate!(validate_mobile, core_validate_mobile);
py_validate!(validate_pincode, core_validate_pincode);
py_validate!(validate_tan, core_validate_tan);
py_validate!(validate_cin, core_validate_cin);
py_validate!(validate_llpin, core_validate_llpin);
py_validate!(validate_voter_id, core_validate_voter_id);
py_validate!(validate_vehicle, core_validate_vehicle);

#[pyfunction]
fn format_mobile_py(py: Python<'_>, input: &Bound<'_, PyAny>) -> Py<PyAny> {
    match extract_string(input) {
        Some(s) => match core_format_mobile(&s) {
            Some(s) => to_py(py, s),
            None => py.None(),
        },
        None => py.None(),
    }
}

#[pyfunction]
fn mask_aadhaar_py(_py: Python<'_>, input: &Bound<'_, PyAny>) -> String {
    match extract_string(input) {
        Some(s) => core_mask_aadhaar(&s),
        None => String::new(),
    }
}

#[pyfunction]
fn detect_py(_py: Python<'_>, input: &Bound<'_, PyAny>) -> String {
    match extract_string(input) {
        Some(s) => core_detect(&s),
        None => "unknown".to_string(),
    }
}

#[pyfunction]
fn validate_many_py(py: Python<'_>, inputs: &Bound<'_, PyAny>) -> Py<PyAny> {
    let list = PyList::empty(py);
    let items: Vec<Py<PyAny>> = match inputs.cast::<PyList>() {
        Ok(list) => list.iter().map(|item| item.unbind()).collect(),
        Err(_) => {
            list.append(result_to_dict(py, &invalid_type_result()))
                .expect("list append");
            return list.into_any().unbind();
        }
    };
    for item in &items {
        let bound = item.bind(py);
        match extract_string(bound) {
            Some(s) => {
                let result = core_validate_many(&[s]);
                list.append(result_to_dict(py, &result[0]))
                    .expect("list append");
            }
            None => {
                list.append(result_to_dict(py, &invalid_type_result()))
                    .expect("list append");
            }
        }
    }
    list.into_any().unbind()
}

fn opt_string_to_py(py: Python<'_>, value: Option<String>) -> Py<PyAny> {
    match value {
        Some(s) => to_py(py, s),
        None => py.None(),
    }
}

#[pyfunction]
fn format_pan_py(py: Python<'_>, input: &Bound<'_, PyAny>) -> Py<PyAny> {
    match extract_string(input) {
        Some(s) => opt_string_to_py(py, core_format_pan(&s)),
        None => py.None(),
    }
}

#[pyfunction]
fn format_gstin_py(py: Python<'_>, input: &Bound<'_, PyAny>) -> Py<PyAny> {
    match extract_string(input) {
        Some(s) => opt_string_to_py(py, core_format_gstin(&s)),
        None => py.None(),
    }
}

#[pyfunction]
fn mask_pan_py(_py: Python<'_>, input: &Bound<'_, PyAny>) -> String {
    match extract_string(input) {
        Some(s) => core_mask_pan(&s),
        None => String::new(),
    }
}

#[pyfunction]
fn mask_mobile_py(_py: Python<'_>, input: &Bound<'_, PyAny>) -> String {
    match extract_string(input) {
        Some(s) => core_mask_mobile(&s),
        None => String::new(),
    }
}

#[pyfunction]
#[pyo3(signature = (entity=None))]
fn generate_pan_py(_py: Python<'_>, entity: Option<&Bound<'_, PyAny>>) -> String {
    let ch = entity
        .and_then(|e| extract_string(e))
        .and_then(|s| s.chars().next())
        .unwrap_or('P');
    core_generate_pan(ch)
}

#[pyfunction]
fn generate_aadhaar_py(_py: Python<'_>) -> String {
    core_generate_aadhaar()
}

#[pyfunction]
#[pyo3(signature = (state_code=None))]
fn generate_gstin_py(_py: Python<'_>, state_code: Option<&Bound<'_, PyAny>>) -> String {
    let code = state_code
        .and_then(|s| extract_string(s))
        .unwrap_or_else(|| "18".to_string());
    core_generate_gstin(&code)
}

#[pyfunction]
fn generate_mobile_py(_py: Python<'_>) -> String {
    core_generate_mobile()
}

#[pyfunction]
fn generate_vehicle_py(_py: Python<'_>) -> String {
    core_generate_vehicle()
}

#[pyfunction]
fn generate_vehicle_bharat_py(_py: Python<'_>) -> String {
    core_generate_vehicle_bharat()
}

#[pymodule]
fn indycheck(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<Options>()?;
    m.add_function(wrap_pyfunction!(default_options, m)?)?;
    m.add_function(wrap_pyfunction!(lenient_options, m)?)?;
    m.add_function(wrap_pyfunction!(no_spaces_hyphens_options, m)?)?;
    m.add_function(wrap_pyfunction!(validate_pan, m)?)?;
    m.add_function(wrap_pyfunction!(validate_aadhaar, m)?)?;
    m.add_function(wrap_pyfunction!(validate_gstin, m)?)?;
    m.add_function(wrap_pyfunction!(validate_ifsc, m)?)?;
    m.add_function(wrap_pyfunction!(validate_upi, m)?)?;
    m.add_function(wrap_pyfunction!(validate_mobile, m)?)?;
    m.add_function(wrap_pyfunction!(validate_pincode, m)?)?;
    m.add_function(wrap_pyfunction!(validate_tan, m)?)?;
    m.add_function(wrap_pyfunction!(validate_cin, m)?)?;
    m.add_function(wrap_pyfunction!(validate_llpin, m)?)?;
    m.add_function(wrap_pyfunction!(validate_voter_id, m)?)?;
    m.add_function(wrap_pyfunction!(validate_vehicle, m)?)?;
    m.add_function(wrap_pyfunction!(validate_pan_with_options, m)?)?;
    m.add_function(wrap_pyfunction!(validate_aadhaar_with_options, m)?)?;
    m.add_function(wrap_pyfunction!(validate_gstin_with_options, m)?)?;
    m.add_function(wrap_pyfunction!(validate_mobile_with_options, m)?)?;
    m.add_function(wrap_pyfunction!(format_mobile_with_options, m)?)?;
    m.add_function(wrap_pyfunction!(format_pan_py, m)?)?;
    m.add_function(wrap_pyfunction!(format_gstin_py, m)?)?;
    m.add_function(wrap_pyfunction!(mask_pan_py, m)?)?;
    m.add_function(wrap_pyfunction!(mask_mobile_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_pan_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_aadhaar_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_gstin_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_mobile_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_vehicle_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_vehicle_bharat_py, m)?)?;
    m.add_function(wrap_pyfunction!(format_mobile_py, m)?)?;
    m.add_function(wrap_pyfunction!(mask_aadhaar_py, m)?)?;
    m.add_function(wrap_pyfunction!(detect_py, m)?)?;
    m.add_function(wrap_pyfunction!(validate_many_py, m)?)?;
    // Friendly Python names for the helpers (the Rust fn names above are
    // the validate_* ones; expose the helpers under their natural names too).
    m.add("format_mobile", m.getattr("format_mobile_py")?)?;
    m.add("mask_aadhaar", m.getattr("mask_aadhaar_py")?)?;
    m.add("detect", m.getattr("detect_py")?)?;
    m.add("validate_many", m.getattr("validate_many_py")?)?;
    m.add("format_pan", m.getattr("format_pan_py")?)?;
    m.add("format_gstin", m.getattr("format_gstin_py")?)?;
    m.add("mask_pan", m.getattr("mask_pan_py")?)?;
    m.add("mask_mobile", m.getattr("mask_mobile_py")?)?;
    m.add("generate_pan", m.getattr("generate_pan_py")?)?;
    m.add("generate_aadhaar", m.getattr("generate_aadhaar_py")?)?;
    m.add("generate_gstin", m.getattr("generate_gstin_py")?)?;
    m.add("generate_mobile", m.getattr("generate_mobile_py")?)?;
    m.add("generate_vehicle", m.getattr("generate_vehicle_py")?)?;
    m.add(
        "generate_vehicle_bharat",
        m.getattr("generate_vehicle_bharat_py")?,
    )?;
    // Aliases (EPIC is the name printed on the voter card; the
    // registration alias matches the Rust/JS API).
    m.add("validate_epic", m.getattr("validate_voter_id")?)?;
    m.add(
        "validate_vehicle_registration",
        m.getattr("validate_vehicle")?,
    )?;
    Ok(())
}
