# indycheck

Offline Indian ID validator — mobile, PAN, Aadhaar, GSTIN, IFSC, UPI, PIN code, TAN, CIN, LLPIN, Voter ID / EPIC and vehicle registration. Format + checksum only, no network, no government database.

```bash
npm install indycheck
```

```ts
import { validatePan, validateMobile, validateTan, generatePan } from "indycheck";

validatePan("ABCPE1234F"); // { valid: true, code: "VALID", parsed: { entity: "Individual", entity_code: "P" } }
validateMobile("+91 98765 43210"); // { valid: true, parsed: { normalized: "9876543210" } }
validateTan("AAAA12345B"); // { valid: true, parsed: { tan: "AAAA12345B" } }
generatePan("P"); // e.g. "XKQPW4821M" — mock test data only, never a real PAN
```

Every validator returns `{ valid, code, reason_en, reason_hi, parsed }` and
never throws on bad input. `reason_hi` is Roman-script Hinglish, exactly
as the Rust core returns it.

## Validators (12)

| Function | Checks | `parsed` on success |
|---|---|---|
| `validateMobile` | 10 digits, first digit 6–9; `+91` / `91` / `0` prefix, spaces and hyphens allowed | `{ normalized }` |
| `validatePan` | `^[A-Z]{5}[0-9]{4}[A-Z]$` | `{ entity, entity_code }` |
| `validateAadhaar` | 12 digits, first digit 2–9, Verhoeff checksum | `{ masked }` |
| `validateGstin` | 15 chars: state code + PAN + entity char + `Z` + Mod-36 check digit | `{ state, state_code, pan }` |
| `validateIfsc` | `^[A-Z]{4}0[A-Z0-9]{6}$` — format only, no checksum | `{ bank_code, branch_code }` |
| `validateUpi` | `name@handle`, handle from a built-in list | `{ handle }` |
| `validatePincode` | 6 digits, first digit 1–9 | `{ pincode }` |
| `validateTan` | 4 letters + 5 digits + 1 letter — format only, no checksum | `{ tan }` |
| `validateCin` | 21 chars: `L`/`U` + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits — format only, no checksum | `{ cin, listing, industry_code, state_code, year, company_type, registration_number }` |
| `validateLlpin` | 3 letters + 4 digits — format only, no checksum | `{ llpin }` |
| `validateVoterId` / `validateEpic` | 3 letters + 7 digits — format only, no checksum | `{ epic }` |
| `validateVehicle` / `validateVehicleRegistration` | e.g. `DL01AB1234`, `DL01A1234` — format only, no checksum | `{ registration, state_code, district, series, number }` |

Also available: `detect` (the Rust detect string in `parsed.type`) and
`validateMany`, and optional Zod schemas (`indycheck/zod`: `panSchema`,
`aadhaarSchema`, `tanSchema`, `cinSchema`, `llpinSchema`, `voterSchema` /
`epicSchema`, `vehicleSchema`, …).

## Options

`validateMobileWithOptions`, `validatePanWithOptions`,
`validateAadhaarWithOptions` and `validateGstinWithOptions` take an
optional partial `Options` object (`{ strict, allow_spaces_hyphens,
normalise_plus91, uppercase }`, all defaulting to `true`):

```ts
import { validateMobileWithOptions, lenientOptions } from "indycheck";

validateMobileWithOptions("5876543210", lenientOptions()); // valid: first-digit rule skipped
validateMobileWithOptions("+91 98765 43210", { normalise_plus91: false }); // INVALID_FORMAT
validatePanWithOptions("abcde1234f", { uppercase: false }); // INVALID_FORMAT
```

Helpers: `defaultOptions()`, `lenientOptions()` (format only — skips
first-digit and checksum checks) and `noSpacesHyphensOptions()`. The
other validators have no options variants, in the Rust core either.

## Format / mask

```ts
import { formatPan, formatGstin, maskPan, maskMobile } from "indycheck";

formatPan("abcde 1234f"); // "ABCDE1234F" (null when the pattern does not match)
formatGstin("18aaapl1234c1zd"); // "18AAAPL1234C1ZD" — check digit NOT verified here
maskPan("ABCDE1234F"); // "ABCDE****F"
maskMobile("+91 98765 43210"); // "******3210"
```

`formatMobile` and `maskAadhaar` keep their older behaviour and return
a `ValidationResult` (same as `validateMobile` / `validateAadhaar`).
A non-empty mask result is **not** proof of validity — use the matching
`validate*` for that.

## Generators — TEST DATA ONLY

```ts
import { generatePan, generateAadhaar, generateGstin, generateMobile } from "indycheck";

generatePan("C"); // syntactically valid PAN, entity Company (unknown char -> "P")
generateAadhaar(); // 12 digits, correct Verhoeff check digit
generateGstin("18"); // syntactically valid GSTIN for Assam (unknown code -> "18")
generateMobile(); // 10 digits, first digit 6-9
```

**Warning: generated values are syntactically valid, not real issued
IDs.** They pass this library's own validators but were never issued
by UIDAI, Income Tax, GSTN or anyone else. Use them only in tests,
demos and form previews — never present them as a real person's ID.
Generators are intentionally unseeded: each call may return a
different value.

Note: PAN entity reporting is lenient — the 4th character is reported in
`parsed.entity`, or `"Unknown"` when it is not in the published entity
list (P, C, H, F, A, T, B, L, J, G), and the PAN is still format-valid.
So `ABCDE1234F` is valid with entity `"Unknown"`, not an error.

## Honest limits

- **Format + checksum only.** A `valid: true` result means the value is
  well-formed and its checksum is correct — not that the ID exists or
  belongs to anyone.
- No checks against UIDAI (Aadhaar), NSDL / Income Tax (PAN), GSTN
  (GSTIN), any bank (IFSC), or any UPI provider. This package makes no
  network requests at all.
- **PAN, IFSC, TAN, CIN, LLPIN, Voter ID and vehicle registration
  numbers have no public checksum.** Only their format is checked.
  The vehicle state-code letters are not checked against a list of
  states, and a format-valid vehicle number does not prove the vehicle
  exists.
- IFSC validation is format-only: it cannot tell you whether a branch
  code really exists.
- UPI validation checks the handle against a built-in list of common
  handles; a new or rare handle may be reported as unknown.
