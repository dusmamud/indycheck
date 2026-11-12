## 0.2.2

- Initial Dart / Flutter package.
- Pure Dart package (no Flutter plugin): hand-written `dart:ffi`
  bindings over the C API in `crates/indycheck-ffi`, same public API
  shape as the Go, JS and Python bindings.
- 14 validators (PAN, Aadhaar, GSTIN, mobile, vehicle incl. Bharat
  BH series, IFSC, UPI, PIN code, TAN, CIN, LLPIN, Voter ID / EPIC),
  plus `detect`, `validateMany` and `version`.
- Test-data generators: `generatePan`, `generateAadhaar`,
  `generateGstin`, `generateMobile`, `generateVehicle` and
  `generateVehicleBharat`.
- Native library loaded from an explicit `Indycheck.init` /
  `setLibraryPath` path, the `INDYCHECK_NATIVE_LIB` environment
  variable, or the platform default library file name; a clear
  `StateError` is thrown when it cannot be found.
