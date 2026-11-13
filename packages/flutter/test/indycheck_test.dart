import 'dart:io';

import 'package:indycheck/indycheck.dart';
import 'package:test/test.dart';

void main() {
  // When INDYCHECK_NATIVE_LIB is set, use that library explicitly (the
  // pre-hook behaviour). When it is unset, the loader resolves the
  // library bundled by the build hook (`package:indycheck/indycheck_ffi`
  // code asset) or the process library — no environment variable needed.
  final libPath = Platform.environment['INDYCHECK_NATIVE_LIB'];
  if (libPath != null && libPath.isNotEmpty) {
    if (!File(libPath).existsSync()) {
      throw StateError(
        'INDYCHECK_NATIVE_LIB points at a missing file: $libPath\n'
        'Build the native library first with `cargo build -p indycheck-ffi --release`.',
      );
    }
    Indycheck.init(libPath);
  }

  group('validators', () {
    test('validatePan accepts a well-formed PAN', () {
      final result = Indycheck.validatePan('ABCDE1234F');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
    });

    test('validatePan rejects a PAN with a digit in the last position', () {
      final result = Indycheck.validatePan('ABCDE12345');
      expect(result.valid, isFalse);
      expect(result.code, 'INVALID_FORMAT');
    });

    test('validateAadhaar accepts a 12-digit number with a valid checksum',
        () {
      final result = Indycheck.validateAadhaar('234567890124');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
      expect(result.parsed?['masked'], 'XXXX XXXX 0124');
    });

    test('validateMobile accepts a plain 10-digit number', () {
      final result = Indycheck.validateMobile('9876543210');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
      expect(result.parsed?['normalized'], '9876543210');
    });

    test('validateGstin accepts a well-formed GSTIN', () {
      final result = Indycheck.validateGstin('27AAAPL1234C1ZE');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
    });

    test('validateVehicle accepts a state-format registration', () {
      final result = Indycheck.validateVehicle('DL01AB1234');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
      expect(result.parsed?['series_type'], 'state');
    });

    test('validateVehicle accepts a Bharat (BH) series registration', () {
      final result = Indycheck.validateVehicle('22BH1234AA');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
      expect(result.parsed?['series_type'], 'bharat');
    });

    test('validateVehicleRegistration is an alias for validateVehicle', () {
      final result = Indycheck.validateVehicleRegistration('DL01AB1234');
      expect(result.valid, isTrue);
      expect(result.code, 'VALID');
    });
  });

  group('detect and validateMany', () {
    test('detect identifies a PAN', () {
      expect(Indycheck.detect('ABCDE1234F'), 'pan');
    });

    test('detect returns unknown for an unrecognised string', () {
      expect(Indycheck.detect('not-an-id'), 'unknown');
    });

    test('validateMany preserves input order', () {
      final results = Indycheck.validateMany(
        ['ABCDE1234F', '9876543210', 'not-an-id'],
      );
      expect(results, hasLength(3));
      expect(results[0].valid, isTrue);
      expect(results[0].code, 'VALID');
      expect(results[1].valid, isTrue);
      expect(results[1].code, 'VALID');
      expect(results[2].valid, isFalse);
    });
  });

  group('generators', () {
    test('generatePan result validates', () {
      final pan = Indycheck.generatePan();
      expect(Indycheck.validatePan(pan).valid, isTrue);
    });

    test('generatePan honours the entity character', () {
      final pan = Indycheck.generatePan(entity: 'C');
      final result = Indycheck.validatePan(pan);
      expect(result.valid, isTrue);
      expect(result.parsed?['entity_code'], 'C');
    });

    test('generateAadhaar result validates', () {
      expect(
        Indycheck.validateAadhaar(Indycheck.generateAadhaar()).valid,
        isTrue,
      );
    });

    test('generateGstin result validates', () {
      expect(
        Indycheck.validateGstin(Indycheck.generateGstin()).valid,
        isTrue,
      );
    });

    test('generateMobile result validates', () {
      expect(
        Indycheck.validateMobile(Indycheck.generateMobile()).valid,
        isTrue,
      );
    });

    test('generateVehicle result validates', () {
      expect(
        Indycheck.validateVehicle(Indycheck.generateVehicle()).valid,
        isTrue,
      );
    });

    test('generateVehicleBharat result contains BH and validates', () {
      final vehicle = Indycheck.generateVehicleBharat();
      expect(vehicle, contains('BH'));
      final result = Indycheck.validateVehicle(vehicle);
      expect(result.valid, isTrue);
      expect(result.parsed?['series_type'], 'bharat');
    });
  });

  group('version', () {
    test('version matches the package version', () {
      expect(Indycheck.version(), '0.2.3');
    });
  });
}
