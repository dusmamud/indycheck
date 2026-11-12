import 'dart:ffi';
import 'dart:io';

/// Native signature shared by every validator: one C string in, one
/// heap-allocated C string out (owned by the caller).
typedef _ValidateNative = Pointer<Utf8> Function(Pointer<Utf8>);
typedef _ValidateDart = Pointer<Utf8> Function(Pointer<Utf8>);

/// Native signature of the no-argument functions (`indycheck_version`
/// and the argument-free generators).
typedef _NoArgNative = Pointer<Utf8> Function();
typedef _NoArgDart = Pointer<Utf8> Function();

typedef _FreeNative = Void Function(Pointer<Utf8>);
typedef _FreeDart = void Function(Pointer<Utf8>);

/// Thin `dart:ffi` bindings over the C API in `crates/indycheck-ffi`.
/// No validation logic lives here — every function calls the matching
/// C function and the caller decodes the JSON it returns.
///
/// Every function returning `char *` returns a heap-allocated string
/// owned by the caller. Release it with [freeString] — never free it
/// directly, and never free the same pointer twice.
class IndycheckBindings {
  IndycheckBindings(DynamicLibrary lib)
      : validatePan = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_pan',
        ),
        validateAadhaar = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_aadhaar',
        ),
        validateGstin = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_gstin',
        ),
        validateMobile = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_mobile',
        ),
        validateVehicle = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_vehicle',
        ),
        validateVehicleRegistration =
            lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_vehicle_registration',
        ),
        validateIfsc = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_ifsc',
        ),
        validateUpi = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_upi',
        ),
        validatePincode = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_pincode',
        ),
        validateTan = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_tan',
        ),
        validateCin = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_cin',
        ),
        validateLlpin = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_llpin',
        ),
        validateVoterId = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_voter_id',
        ),
        validateEpic = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_epic',
        ),
        detect = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_detect',
        ),
        validateMany = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_validate_many',
        ),
        generatePan = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_generate_pan',
        ),
        generateGstin = lib.lookupFunction<_ValidateNative, _ValidateDart>(
          'indycheck_generate_gstin',
        ),
        generateAadhaar = lib.lookupFunction<_NoArgNative, _NoArgDart>(
          'indycheck_generate_aadhaar',
        ),
        generateMobile = lib.lookupFunction<_NoArgNative, _NoArgDart>(
          'indycheck_generate_mobile',
        ),
        generateVehicle = lib.lookupFunction<_NoArgNative, _NoArgDart>(
          'indycheck_generate_vehicle',
        ),
        generateVehicleBharat =
            lib.lookupFunction<_NoArgNative, _NoArgDart>(
          'indycheck_generate_vehicle_bharat',
        ),
        version = lib.lookupFunction<_NoArgNative, _NoArgDart>(
          'indycheck_version',
        ),
        freeString = lib.lookupFunction<_FreeNative, _FreeDart>(
          'indycheck_free_string',
        );

  final Pointer<Utf8> Function(Pointer<Utf8>) validatePan;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateAadhaar;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateGstin;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateMobile;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateVehicle;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateVehicleRegistration;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateIfsc;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateUpi;
  final Pointer<Utf8> Function(Pointer<Utf8>) validatePincode;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateTan;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateCin;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateLlpin;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateVoterId;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateEpic;
  final Pointer<Utf8> Function(Pointer<Utf8>) detect;
  final Pointer<Utf8> Function(Pointer<Utf8>) validateMany;
  final Pointer<Utf8> Function(Pointer<Utf8>) generatePan;
  final Pointer<Utf8> Function(Pointer<Utf8>) generateGstin;
  final Pointer<Utf8> Function() generateAadhaar;
  final Pointer<Utf8> Function() generateMobile;
  final Pointer<Utf8> Function() generateVehicle;
  final Pointer<Utf8> Function() generateVehicleBharat;
  final Pointer<Utf8> Function() version;
  final void Function(Pointer<Utf8>) freeString;
}

/// File name of the native library on the current desktop OS.
String _defaultLibraryFileName() {
  if (Platform.isMacOS) {
    return 'libindycheck_ffi.dylib';
  }
  if (Platform.isWindows) {
    return 'indycheck_ffi.dll';
  }
  return 'libindycheck_ffi.so';
}

/// Loads the native library.
///
/// Resolution order: [explicitPath] first, then the
/// `INDYCHECK_NATIVE_LIB` environment variable, then the platform's
/// default library file name (`libindycheck_ffi.so` on Linux,
/// `libindycheck_ffi.dylib` on macOS, `indycheck_ffi.dll` on Windows).
/// On Android and iOS the library is expected to be linked into the
/// app binary, so the process library is used instead.
///
/// Throws a [StateError] naming the expected file and how to build it
/// when the library cannot be loaded.
DynamicLibrary loadIndycheckLibrary([String? explicitPath]) {
  final fromEnv = Platform.environment['INDYCHECK_NATIVE_LIB'];
  final path = explicitPath ??
      (fromEnv != null && fromEnv.isNotEmpty ? fromEnv : null);
  if (path != null) {
    try {
      return DynamicLibrary.open(path);
    } on ArgumentError {
      throw StateError(
        'indycheck: could not load the native library at "$path". '
        'Build it first with `cargo build -p indycheck-ffi --release` '
        'from the indycheck repo, then point INDYCHECK_NATIVE_LIB at '
        'the built library.',
      );
    }
  }
  if (Platform.isAndroid || Platform.isIOS) {
    return DynamicLibrary.process();
  }
  final fileName = _defaultLibraryFileName();
  try {
    return DynamicLibrary.open(fileName);
  } on ArgumentError {
    throw StateError(
      'indycheck: could not load "$fileName" — the native library was '
      'not found. Build it with `cargo build -p indycheck-ffi '
      '--release` from the indycheck repo and either put the built '
      'library on the library search path or set INDYCHECK_NATIVE_LIB '
      'to its full path.',
    );
  }
}
