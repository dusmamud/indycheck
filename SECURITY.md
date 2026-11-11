# Security Policy

## What indycheck does — and does not do

indycheck performs **offline format + checksum validation only**.
It does not connect to UIDAI, NSDL, GSTN, or any government service,
and it cannot verify that an identity document is genuine, active, or
belongs to a person. A `valid: true` result means the string is
well-formed — nothing more.

Do not use indycheck as KYC verification, identity proof, or a
substitute for an official verification API.

## Aadhaar handling

- Aadhaar numbers must be masked (`XXXX XXXX 0124`) whenever they are
  displayed, logged, or stored. indycheck provides `mask_aadhaar` for
  this; never log a full Aadhaar number.
- Never commit real Aadhaar, PAN, or GSTIN numbers to this repository.
  Use the mock generators (`generate_*`) for test data.

## Reporting a vulnerability

If you find a security issue (for example, a validator that accepts a
string it must reject, or a masking function that leaks digits), please
open a GitHub issue in `dusmamud/indycheck` with the input, the
expected result, and the actual result — using **generated test data
only, never a real ID**. Do not include real personal identifiers in
any report.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes — current development line |
