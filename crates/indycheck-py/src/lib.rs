//! Python bindings for indycheck — thin PyO3 wrappers over the Rust core.
//!
//! All validation logic lives in the `indycheck` crate; this crate only
//! converts results to Python dicts. Build with `maturin develop` /
//! `maturin build` (from this directory).

use ::indycheck::{
    detect as core_detect, format_gstin as core_format_gstin, format_mobile as core_format_mobile,
    format_pan as core_format_pan, generate_aadhaar as core_generate_aadhaar,
    generate_gstin as core_generate_gstin, generate_mobile as core_generate_mobile,
    generate_pan as core_generate_pan, mask_aadhaar as core_mask_aadhaar,
    mask_mobile as core_mask_mobile, mask_pan as core_mask_pan,
    validate_aadhaar as core_validate_aadhaar, validate_cin as core_validate_cin,
    validate_gstin as core_validate_gstin, validate_ifsc as core_validate_ifsc,
    validate_llpin as core_validate_llpin, validate_many as core_validate_many,
    validate_mobile as core_validate_mobile, validate_pan as core_validate_pan,
    validate_pincode as core_validate_pincode, validate_tan as core_validate_tan,
    validate_upi as core_validate_upi, validate_vehicle as core_validate_vehicle,
    validate_voter_id as core_validate_voter_id, ValidationResult,
};
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};
use pyo3::ToPyObject;

fn value_to_py(py: Python<'_>, value: &serde_json::Value) -> PyObject {
    match value {
        serde_json::Value::Null => py.None(),
        serde_json::Value::Bool(b) => b.to_object(py),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                i.to_object(py)
            } else if let Some(u) = n.as_u64() {
                u.to_object(py)
            } else if let Some(f) = n.as_f64() {
                f.to_object(py)
            } else {
                py.None()
            }
        }
        serde_json::Value::String(s) => s.to_object(py),
        serde_json::Value::Array(items) => {
            let list = PyList::empty_bound(py);
            for item in items {
                list.append(value_to_py(py, item)).expect("list append");
            }
            list.into()
        }
        serde_json::Value::Object(map) => {
            let dict = PyDict::new_bound(py);
            for (k, v) in map {
                dict.set_item(k, value_to_py(py, v)).expect("dict set");
            }
            dict.into()
        }
    }
}

fn result_to_dict(py: Python<'_>, result: &ValidationResult) -> PyObject {
    let dict = PyDict::new_bound(py);
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
    dict.into()
}

macro_rules! py_validate {
    ($name:ident, $func:ident) => {
        #[pyfunction]
        fn $name(py: Python<'_>, input: String) -> PyObject {
            result_to_dict(py, &$func(&input))
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
fn format_mobile_py(py: Python<'_>, input: String) -> PyObject {
    match core_format_mobile(&input) {
        Some(s) => s.to_object(py),
        None => py.None(),
    }
}

#[pyfunction]
fn mask_aadhaar_py(_py: Python<'_>, input: String) -> String {
    core_mask_aadhaar(&input)
}

#[pyfunction]
fn detect_py(_py: Python<'_>, input: String) -> String {
    core_detect(&input)
}

#[pyfunction]
fn validate_many_py(py: Python<'_>, inputs: Vec<String>) -> PyObject {
    let results = core_validate_many(&inputs);
    let list = PyList::empty_bound(py);
    for result in &results {
        list.append(result_to_dict(py, result))
            .expect("list append");
    }
    list.into()
}

fn opt_string_to_py(py: Python<'_>, value: Option<String>) -> PyObject {
    match value {
        Some(s) => s.to_object(py),
        None => py.None(),
    }
}

#[pyfunction]
fn format_pan_py(py: Python<'_>, input: String) -> PyObject {
    opt_string_to_py(py, core_format_pan(&input))
}

#[pyfunction]
fn format_gstin_py(py: Python<'_>, input: String) -> PyObject {
    opt_string_to_py(py, core_format_gstin(&input))
}

#[pyfunction]
fn mask_pan_py(_py: Python<'_>, input: String) -> String {
    core_mask_pan(&input)
}

#[pyfunction]
fn mask_mobile_py(_py: Python<'_>, input: String) -> String {
    core_mask_mobile(&input)
}

#[pyfunction]
fn generate_pan_py(_py: Python<'_>, entity: String) -> String {
    core_generate_pan(entity.chars().next().unwrap_or('P'))
}

#[pyfunction]
fn generate_aadhaar_py(_py: Python<'_>) -> String {
    core_generate_aadhaar()
}

#[pyfunction]
fn generate_gstin_py(_py: Python<'_>, state_code: String) -> String {
    core_generate_gstin(&state_code)
}

#[pyfunction]
fn generate_mobile_py(_py: Python<'_>) -> String {
    core_generate_mobile()
}

#[pymodule]
fn indycheck(m: &Bound<'_, PyModule>) -> PyResult<()> {
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
    m.add_function(wrap_pyfunction!(format_pan_py, m)?)?;
    m.add_function(wrap_pyfunction!(format_gstin_py, m)?)?;
    m.add_function(wrap_pyfunction!(mask_pan_py, m)?)?;
    m.add_function(wrap_pyfunction!(mask_mobile_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_pan_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_aadhaar_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_gstin_py, m)?)?;
    m.add_function(wrap_pyfunction!(generate_mobile_py, m)?)?;
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
    Ok(())
}
