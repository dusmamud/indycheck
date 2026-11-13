import 'dart:convert';
import 'dart:ffi';

import 'package:ffi/ffi.dart';

import 'indycheck_bindings.dart';
import 'result.dart';

/// Offline Indian ID validation, backed by the Rust core in
/// `crates/indycheck` through the C API in `crates/indycheck-ffi`.
///
/// No validation logic lives in this class — every method calls the
/// matching C function and decodes the JSON it returns, so Dart
/// returns the same answer as Rust for the same input.
///
/// A failed validation is a normal [ValidationResult] with `valid`
/// set to `false`; the methods below only throw on transport failures
/// (the native library cannot be loaded, or it returns null).
///
/// Before first use, the native library must be loadable. In a normal
/// Dart or Flutter build the build hook downloads the prebuilt library
/// from the indycheck GitHub release and bundles it automatically, so
/// no setup is needed. To use a different library instead, build it
/// and set the `INDYCHECK_NATIVE_LIB` environment variable to the
/// built library, or call [Indycheck.init] / [setLibraryPath] with
/// its path:
///
/// ```sh
/// cargo build -p indycheck-ffi --release
/// ```
class Indycheck {
  Indycheck._();

  static IndycheckBindings? _bindings;
  static String? _explicitPath;

  /// Whether the native library has been loaded.
  static bool get isLoaded => _bindings != null;

  /// Loads the native library from [libPath].
  ///
  /// Call with no argument to (re)load from the `INDYCHECK_NATIVE_LIB`
  /// environment variable, or from the native asset bundled by the
  /// build hook when the variable is unset. Throws a [StateError]
  /// naming the expected file and how to build it when loading fails.
  static void init([String? libPath]) {
    _explicitPath = libPath;
    _bindings = IndycheckBindings(loadIndycheckLibrary(libPath));
  }

  /// Loads the native library from the given path. Equivalent to
  /// `init(libPath)`.
  static void setLibraryPath(String libPath) => init(libPath);

  static IndycheckBindings get _lib {
    return _bindings ??=
        IndycheckBindings(loadIndycheckLibrary(_explicitPath));
  }

  /// Runs one C validator over [input] and decodes its JSON result.
  /// The C strings in both directions are freed by the caller.
  static ValidationResult _validate(
    Pointer<Utf8> Function(Pointer<Utf8>) fn,
    String input,
  ) {
    final bindings = _lib;
    final cInput = input.toNativeUtf8(allocator: calloc);
    try {
      final ptr = fn(cInput);
      if (ptr == nullptr) {
        throw StateError('indycheck: native library returned null.');
      }
      try {
        return ValidationResult.fromJson(
          jsonDecode(ptr.toDartString()) as Map<String, dynamic>,
        );
      } finally {
        bindings.freeString(ptr);
      }
    } finally {
      calloc.free(cInput);
    }
  }

  /// Runs one C function that takes a string and returns a plain
  /// (non-JSON) string, e.g. [detect] and the argument-taking
  /// generators.
  static String _plainString(
    Pointer<Utf8> Function(Pointer<Utf8>) fn,
    String input,
  ) {
    final bindings = _lib;
    final cInput = input.toNativeUtf8(allocator: calloc);
    try {
      final ptr = fn(cInput);
      if (ptr == nullptr) {
        throw StateError('indycheck: native library returned null.');
      }
      try {
        return ptr.toDartString();
      } finally {
        bindings.freeString(ptr);
      }
    } finally {
      calloc.free(cInput);
    }
  }

  /// Runs one C function that takes no argument and returns a plain
  /// string, e.g. [version] and the argument-free generators.
  static String _plainStringNoArg(Pointer<Utf8> Function() fn) {
    final bindings = _lib;
    final ptr = fn();
    if (ptr == nullptr) {
      throw StateError('indycheck: native library returned null.');
    }
    try {
      return ptr.toDartString();
    } finally {
      bindings.freeString(ptr);
    }
  }

  /// Validates a PAN, e.g. `ABCDE1234F`. Format only — PAN has no
  /// public checksum. On success, `parsed` holds `entity` and
  /// `entity_code`.
  static ValidationResult validatePan(String input) =>
      _validate(_lib.validatePan, input);

  /// Validates a 12-digit Aadhaar number (Verhoeff checksum). On
  /// success, `parsed` holds `masked`.
  static ValidationResult validateAadhaar(String input) =>
      _validate(_lib.validateAadhaar, input);

  /// Validates a 15-character GSTIN. On success, `parsed` holds
  /// `state`, `state_code` and `pan`.
  static ValidationResult validateGstin(String input) =>
      _validate(_lib.validateGstin, input);

  /// Validates an Indian mobile number (10 digits, first digit 6–9;
  /// `+91` / `91` / `0` prefix, spaces and hyphens allowed). On
  /// success, `parsed` holds `normalized`.
  static ValidationResult validateMobile(String input) =>
      _validate(_lib.validateMobile, input);

  /// Validates a vehicle registration number — state format
  /// (e.g. `DL01AB1234`) or Bharat (BH) series (e.g. `22BH1234AA`).
  /// On success, `parsed['series_type']` is `'state'` or `'bharat'`.
  static ValidationResult validateVehicle(String input) =>
      _validate(_lib.validateVehicle, input);

  /// Alias for [validateVehicle].
  static ValidationResult validateVehicleRegistration(String input) =>
      _validate(_lib.validateVehicleRegistration, input);

  /// Validates an IFSC (11 characters, format only). On success,
  /// `parsed` holds `bank_code` and `branch_code`.
  static ValidationResult validateIfsc(String input) =>
      _validate(_lib.validateIfsc, input);

  /// Validates a UPI ID (`name@handle`). On success, `parsed` holds
  /// `handle`.
  static ValidationResult validateUpi(String input) =>
      _validate(_lib.validateUpi, input);

  /// Validates a 6-digit PIN code. On success, `parsed` holds
  /// `pincode`.
  static ValidationResult validatePincode(String input) =>
      _validate(_lib.validatePincode, input);

  /// Validates a TAN (format only, no checksum). On success, `parsed`
  /// holds `tan`.
  static ValidationResult validateTan(String input) =>
      _validate(_lib.validateTan, input);

  /// Validates a CIN (21 characters, format only). On success,
  /// `parsed` holds `cin`, `listing`, `industry_code`, `state_code`,
  /// `year`, `company_type` and `registration_number`.
  static ValidationResult validateCin(String input) =>
      _validate(_lib.validateCin, input);

  /// Validates an LLPIN (3 letters + 4 digits, format only). On
  /// success, `parsed` holds `llpin`.
  static ValidationResult validateLlpin(String input) =>
      _validate(_lib.validateLlpin, input);

  /// Validates a Voter ID / EPIC (3 letters + 7 digits, format only).
  /// On success, `parsed` holds `epic`.
  static ValidationResult validateVoterId(String input) =>
      _validate(_lib.validateVoterId, input);

  /// Alias for [validateVoterId].
  static ValidationResult validateEpic(String input) =>
      _validate(_lib.validateEpic, input);

  /// Detects the type of an Indian ID string. Returns `'pan'`,
  /// `'aadhaar'`, `'gstin'`, `'ifsc'`, `'upi'`, `'mobile'`,
  /// `'pincode'`, `'tan'`, `'cin'`, `'llpin'`, `'voter'`, `'vehicle'`
  /// or `'unknown'`.
  static String detect(String input) => _plainString(_lib.detect, input);

  /// Validates many inputs in one call. Results are returned in the
  /// same order as [inputs].
  static List<ValidationResult> validateMany(List<String> inputs) {
    final bindings = _lib;
    final cInput = jsonEncode(inputs).toNativeUtf8(allocator: calloc);
    try {
      final ptr = bindings.validateMany(cInput);
      if (ptr == nullptr) {
        throw StateError('indycheck: native library returned null.');
      }
      try {
        final decoded = jsonDecode(ptr.toDartString()) as List;
        return decoded
            .map(
              (item) =>
                  ValidationResult.fromJson(item as Map<String, dynamic>),
            )
            .toList();
      } finally {
        bindings.freeString(ptr);
      }
    } finally {
      calloc.free(cInput);
    }
  }

  /// Returns the indycheck core version, e.g. `'0.2.2'`.
  static String version() => _plainStringNoArg(_lib.version);

  /// Generates a syntactically valid PAN for testing. [entity] is the
  /// entity character (`'P'`, `'C'`, ...); an unknown value falls back
  /// to `'P'` (Individual). **Test data only — not a real issued PAN.**
  static String generatePan({String entity = 'P'}) =>
      _plainString(_lib.generatePan, entity);

  /// Generates a syntactically valid 12-digit Aadhaar number (correct
  /// Verhoeff check digit). **Test data only — not a real issued
  /// Aadhaar number.**
  static String generateAadhaar() => _plainStringNoArg(_lib.generateAadhaar);

  /// Generates a syntactically valid GSTIN for the given 2-digit state
  /// code (`'18'` for Assam). An unknown state code falls back to
  /// `'18'`. **Test data only — not a real issued GSTIN.**
  static String generateGstin({String stateCode = '18'}) =>
      _plainString(_lib.generateGstin, stateCode);

  /// Generates a syntactically valid Indian mobile number (10 digits,
  /// first digit 6–9). **Test data only — not a real person's number.**
  static String generateMobile() => _plainStringNoArg(_lib.generateMobile);

  /// Generates a syntactically valid state-format vehicle registration
  /// number (e.g. `DL01AB1234`). **Test data only — not a real issued
  /// registration number.**
  static String generateVehicle() => _plainStringNoArg(_lib.generateVehicle);

  /// Generates a syntactically valid Bharat (BH) series vehicle number
  /// (e.g. `22BH1234AA`). **Test data only — not a real issued
  /// registration number.**
  static String generateVehicleBharat() =>
      _plainStringNoArg(_lib.generateVehicleBharat);
}
