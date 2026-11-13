// ignore_for_file: avoid_print — this is a console example; printing the
// validation results is its whole purpose.
import 'package:indycheck/indycheck.dart';

void main() {
  final pan = Indycheck.validatePan('ABCDE1234F');
  print(
    'PAN ABCDE1234F: valid=${pan.valid} code=${pan.code} '
    'entity=${pan.parsed?['entity']}',
  );

  final mobile = Indycheck.validateMobile('+91 98765 43210');
  print(
    'Mobile +91 98765 43210: valid=${mobile.valid} '
    'normalized=${mobile.parsed?['normalized']}',
  );

  final vehicle = Indycheck.validateVehicle('22BH1234AA');
  print(
    'Vehicle 22BH1234AA: valid=${vehicle.valid} '
    'series_type=${vehicle.parsed?['series_type']}',
  );

  print('Detected type of ABCDE1234F: ${Indycheck.detect('ABCDE1234F')}');

  // Generated values are test data only — never real issued IDs.
  print('Generated test PAN: ${Indycheck.generatePan()}');
  print('indycheck core version: ${Indycheck.version()}');
}
