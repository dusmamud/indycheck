// indycheck — Node example.
// Run after building the JS package:  cd packages/js && npm run build
// Then:  node examples/node-basic.mjs
import {
  detect,
  generatePan,
  maskAadhaar,
  validateAadhaar,
  validateGstin,
  validateMobile,
  validatePan,
  validateVehicle,
} from "../packages/js/dist/index.js";

console.log(validatePan("XYZCP1234A")); // valid: 4th char C = Company
// "ABCDE1234F" is also valid, with parsed.entity "Unknown" — its 4th
// character (D) is not in the published entity list (P, C, H, F, A, T,
// B, L, J, G), but that does not make the PAN invalid.
console.log(validateMobile("+91 98765 43210"));
console.log(validateAadhaar("234567890124"));
console.log(validateGstin("27AAPFU0939F1ZV"));
console.log(maskAadhaar("234567890124"));
console.log(detect("SBIN0001234"));
// New in v0.1 (expanded scope): vehicle registration — format only,
// no checksum, like TAN / CIN / LLPIN / Voter ID.
console.log(validateVehicle("DL01AB1234"));
console.log(validateVehicle("DL 01 AB 1234")); // spaces/hyphens are stripped
// Generators are TEST DATA ONLY: syntactically valid, never a real ID.
console.log(generatePan("P")); // e.g. "XKQPW4821M" — use only in tests/demos
console.log(validatePan(generatePan("C"))); // a generated PAN re-validates
