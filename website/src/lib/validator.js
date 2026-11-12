/**
 * indycheck-lite — pure-JS reference implementation of the indycheck rules.
 *
 * Used by the landing-page demo and as the playground fallback until the
 * real WASM build (crates/indycheck-wasm/pkg) is wired in. Every function
 * here mirrors the Rust core: format checks + checksums only. Nothing here
 * (or in the Rust core) contacts UIDAI, NSDL, GSTN, MCA, ECI or any bank —
 * a "valid" result means the value is well-formed, not that it belongs to
 * a real person or business.
 *
 * 12 validators: pan, aadhaar, gstin, ifsc, upi, mobile, pincode, tan,
 * cin, llpin, epic (Voter ID), vehicle.
 *
 * Options (2nd argument of every validator, see docs/options):
 *   { strict, allowSpaces, allowHyphens, normalizeCountryCode, uppercase }
 * Result shape (same in every language binding):
 *   { ok, type, value, normalized?, code, reason_en, reason_hi, parsed? }
 * `code` is one of the exact codes the Rust core returns — see
 * /error-codes/ and `shared/spec.md`: VALID, EMPTY, INVALID_LENGTH,
 * INVALID_FORMAT, INVALID_CHECKSUM, INVALID_FIRST_DIGIT,
 * INVALID_STATE_CODE, INVALID_ENTITY (reserved, never emitted as of v0.2.0),
 * INVALID_HANDLE, UNKNOWN_TYPE.
 * `parsed` holds the structured fields extracted from a valid value,
 * with exactly the keys the core returns for that type.
 *
 * Also in this file: mask/format helpers, test-data generators
 * (TEST DATA ONLY — never real IDs) and detect().
 */

// ---------------------------------------------------------------- Verhoeff
// Tables from the Verhoeff algorithm (used by Aadhaar / UIDAI).
const VERHOEFF_D = [
	[0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
	[1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
	[2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
	[3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
	[4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
	[5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
	[6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
	[7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
	[8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
	[9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
	[0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
	[1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
	[5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
	[8, 0, 1, 3, 2, 4, 9, 6, 7, 5],
	[9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
	[4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
	[2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
	[7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffValid(digits) {
	// Standard Verhoeff validation: process digits right-to-left, with
	// the permutation table indexed by position from the right (0-based),
	// exactly as crates/indycheck/src/verhoeff.rs does.
	let c = 0;
	const n = digits.length;
	for (let i = 0; i < n; i++) {
		c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(digits[n - 1 - i])]];
	}
	return c === 0;
}

// ------------------------------------------------------------------ helpers
function fail(type, value, code, reason_en, reason_hi) {
	return { ok: false, type, value, code, reason_en, reason_hi };
}
function pass(type, value, normalized, parsed) {
	return {
		ok: true,
		type,
		value,
		normalized,
		code: 'VALID',
		reason_en: 'Valid format.',
		reason_hi: 'मान्य प्रारूप।',
		parsed,
	};
}
const isDigits = (s) => /^[0-9]+$/.test(s);

// ------------------------------------------------------------------- options
// Validators whose separator conventions allow spaces even in strict mode
// (Aadhaar is printed in groups of 4; mobiles and PIN codes are typed
// with spaces/dashes by users). LLPIN (AAA-1234) and vehicle plates
// (DL 01 AB 1234) allow their display separators even in strict mode.
const SPACE_TOLERANT = new Set(['aadhaar', 'mobile', 'pincode', 'vehicle']);
const HYPHEN_TOLERANT = new Set(['aadhaar', 'mobile', 'pincode', 'llpin', 'vehicle']);
// IDs whose letters are case-insensitive (uppercased before checking).
const LETTER_TYPES = new Set(['pan', 'gstin', 'ifsc', 'tan', 'cin', 'llpin', 'epic', 'vehicle']);

export const DEFAULT_OPTIONS = Object.freeze({
	strict: true,
	allowSpaces: false,
	allowHyphens: false,
	normalizeCountryCode: true,
	uppercase: true,
});

export function resolveOptions(opts = {}) {
	const o = { ...DEFAULT_OPTIONS, ...(opts || {}) };
	if (o.strict === false) {
		// Lenient mode implies every normalisation: strip spaces/hyphens,
		// uppercase letter IDs, strip the +91 country code.
		o.allowSpaces = true;
		o.allowHyphens = true;
		o.normalizeCountryCode = true;
		o.uppercase = true;
	}
	return o;
}

// Strip (or reject) separators per the options, then uppercase letter IDs.
// Returns { value } or { error: 'spaces' | 'hyphens', reason_en, reason_hi }.
function prepare(type, raw, opts) {
	const o = resolveOptions(opts);
	const allowSpace = o.allowSpaces || SPACE_TOLERANT.has(type);
	const allowHyphen = o.allowHyphens || HYPHEN_TOLERANT.has(type);
	if (!allowSpace && /\s/.test(raw)) {
		return {
			error: fail(
				type,
				raw,
				'INVALID_FORMAT',
				'Spaces are not allowed in strict mode — set allowSpaces: true or use lenient mode (strict: false).',
				'स्ट्रिक्ट मोड में स्पेस की अनुमति नहीं है — allowSpaces: true सेट करें या लीनिएंट मोड (strict: false) इस्तेमाल करें।',
			),
		};
	}
	if (!allowHyphen && raw.includes('-')) {
		return {
			error: fail(
				type,
				raw,
				'INVALID_FORMAT',
				'Hyphens are not allowed in strict mode — set allowHyphens: true or use lenient mode (strict: false).',
				'स्ट्रिक्ट मोड में हाइफ़न की अनुमति नहीं है — allowHyphens: true सेट करें या लीनिएंट मोड (strict: false) इस्तेमाल करें।',
			),
		};
	}
	let value = raw.replace(/[\s-]/g, '');
	if (LETTER_TYPES.has(type) && o.uppercase) value = value.toUpperCase();
	return { value, options: o };
}

// ---------------------------------------------------------------------- PAN
// PAN entity names by 4th character, exactly as the Rust core reports
// them (crates/indycheck/src/pan.rs). A 4th character that is not in
// this list is reported as entity "Unknown" and the PAN is STILL valid —
// the canonical format example ABCDE1234F itself has 4th character D.
// INVALID_ENTITY is a reserved stable code, not emitted as of v0.2.0.
const PAN_ENTITY_NAMES = {
	P: 'Individual',
	C: 'Company',
	H: 'HUF',
	F: 'Firm',
	A: 'AOP',
	T: 'Trust',
	B: 'BODY',
	L: 'Local Authority',
	J: 'Artificial Juridical Person',
	G: 'Government',
};

export function validatePan(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('pan', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('pan', raw, 'EMPTY', 'PAN is empty.', 'PAN खाली है।');
	if (value.length !== 10)
		return fail('pan', raw, 'INVALID_LENGTH', 'PAN must be exactly 10 characters.', 'PAN ठीक 10 अक्षरों का होना चाहिए।');
	if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value))
		return fail(
			'pan',
			raw,
			'INVALID_FORMAT',
			'PAN must look like ABCDE1234F — 5 letters, 4 digits, 1 letter.',
			'PAN का प्रारूप ABCDE1234F जैसा होना चाहिए — 5 अक्षर, 4 अंक, 1 अक्षर।',
		);
	const entityCode = value[3];
	const entity = PAN_ENTITY_NAMES[entityCode] || 'Unknown';
	return pass('pan', raw, value, { entity, entity_code: entityCode });
}

// ------------------------------------------------------------------ Aadhaar
export function validateAadhaar(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('aadhaar', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('aadhaar', raw, 'EMPTY', 'Aadhaar number is empty.', 'आधार नंबर खाली है।');
	if (value.length !== 12)
		return fail('aadhaar', raw, 'INVALID_LENGTH', 'Aadhaar must be exactly 12 digits.', 'आधार ठीक 12 अंकों का होना चाहिए।');
	if (!isDigits(value))
		return fail('aadhaar', raw, 'INVALID_FORMAT', 'Aadhaar must contain only digits (spaces are allowed).', 'आधार में केवल अंक होने चाहिए (स्पेस चलेंगे)।');
	if (value[0] === '0' || value[0] === '1')
		return fail(
			'aadhaar',
			raw,
			'INVALID_FIRST_DIGIT',
			'Aadhaar cannot start with 0 or 1.',
			'आधार 0 या 1 से शुरू नहीं हो सकता।',
		);
	if (!verhoeffValid(value))
		return fail(
			'aadhaar',
			raw,
			'INVALID_CHECKSUM',
			'Aadhaar checksum failed (Verhoeff) — the number is mistyped or fake.',
			'आधार चेकसम गलत है (Verhoeff) — नंबर गलत टाइप हुआ है या नकली है।',
		);
	return pass('aadhaar', raw, value, { masked: `XXXX XXXX ${value.slice(8)}` });
}

// -------------------------------------------------------------------- GSTIN
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// GST state codes 01–38, names exactly as the Rust core reports them
// (crates/indycheck/src/data.rs).
const GSTIN_STATES = {
	'01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
	'05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
	'09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
	'13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
	'17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
	'21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
	'25': 'Daman and Diu and Dadra and Nagar Haveli', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra',
	'28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
	'32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
	'36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export function gstinCheckChar(first14) {
	// Mod-36 Luhn: starting from the RIGHTMOST character of the first 14,
	// the factor alternates 2, 1, 2, 1… — exactly as
	// crates/indycheck/src/luhn36.rs does.
	let factor = 2;
	let sum = 0;
	for (let i = 13; i >= 0; i--) {
		const code = GSTIN_CHARS.indexOf(first14[i]);
		const product = factor * code;
		sum += Math.floor(product / 36) + (product % 36);
		factor = factor === 2 ? 1 : 2;
	}
	return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

export function validateGstin(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('gstin', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('gstin', raw, 'EMPTY', 'GSTIN is empty.', 'GSTIN खाली है।');
	if (value.length !== 15)
		return fail('gstin', raw, 'INVALID_LENGTH', 'GSTIN must be exactly 15 characters.', 'GSTIN ठीक 15 अक्षरों का होना चाहिए।');
	// The core checks, in order: first two characters are digits, then the
	// state code (01–38), then the PAN part (pattern only — the 4th
	// character is NOT checked against the entity list), then the 13th
	// character (alphanumeric), the 14th ('Z'), the 15th (alphanumeric),
	// and finally the Mod-36 Luhn check digit. A bad PAN part is
	// INVALID_FORMAT, not a separate code.
	if (!/^[0-9]{2}/.test(value))
		return fail('gstin', raw, 'INVALID_FORMAT', 'GSTIN must start with a 2-digit state code.', 'GSTIN 2 अंकों के राज्य कोड से शुरू होना चाहिए।');
	const stateCode = value.slice(0, 2);
	if (!GSTIN_STATES[stateCode])
		return fail(
			'gstin',
			raw,
			'INVALID_STATE_CODE',
			`State code "${stateCode}" is not a valid Indian state/UT code (01–38).`,
			`राज्य कोड "${stateCode}" मान्य भारतीय राज्य/केंद्र शासित प्रदेश कोड नहीं है (01–38)।`,
		);
	const panPart = value.slice(2, 12);
	if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panPart))
		return fail(
			'gstin',
			raw,
			'INVALID_FORMAT',
			'GSTIN characters 3–12 must be a PAN in 5 letters, 4 digits, 1 letter format.',
			'GSTIN के 3 से 12 तक के अक्षर PAN प्रारूप में होने चाहिए (5 अक्षर, 4 अंक, 1 अक्षर)।',
		);
	if (!/[0-9A-Z]/.test(value[12]))
		return fail('gstin', raw, 'INVALID_FORMAT', 'The 13th character of a GSTIN must be a letter or digit (entity number).', 'GSTIN का 13वाँ अक्षर एक अक्षर या अंक होना चाहिए (इकाई संख्या)।');
	if (value[13] !== 'Z')
		return fail('gstin', raw, 'INVALID_FORMAT', 'The 14th character of a GSTIN must be "Z".', 'GSTIN का 14वाँ अक्षर "Z" होना चाहिए।');
	if (!/[0-9A-Z]/.test(value[14]))
		return fail('gstin', raw, 'INVALID_FORMAT', 'The 15th character of a GSTIN must be a letter or digit (check digit).', 'GSTIN का 15वाँ अक्षर एक अक्षर या अंक होना चाहिए (चेक अंक)।');
	if (value[14] !== gstinCheckChar(value.slice(0, 14)))
		return fail(
			'gstin',
			raw,
			'INVALID_CHECKSUM',
			'GSTIN checksum failed (Mod-36 Luhn) — the last character does not match.',
			'GSTIN चेकसम गलत है (Mod-36 Luhn) — अंतिम अक्षर मेल नहीं खाता।',
		);
	return pass('gstin', raw, value, {
		state: GSTIN_STATES[stateCode],
		state_code: stateCode,
		pan: panPart,
	});
}

// --------------------------------------------------------------------- IFSC
export function validateIfsc(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('ifsc', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('ifsc', raw, 'EMPTY', 'IFSC is empty.', 'IFSC खाली है।');
	if (value.length !== 11)
		return fail('ifsc', raw, 'INVALID_LENGTH', 'IFSC must be exactly 11 characters.', 'IFSC ठीक 11 अक्षरों का होना चाहिए।');
	if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value))
		return fail(
			'ifsc',
			raw,
			'INVALID_FORMAT',
			'IFSC must look like SBIN0001234 — 4-letter bank code, then 0, then 6 letters/digits.',
			'IFSC का प्रारूप SBIN0001234 जैसा होना चाहिए — 4 अक्षरों का बैंक कोड, फिर 0, फिर 6 अक्षर/अंक।',
		);
	return pass('ifsc', raw, value, {
		bank_code: value.slice(0, 4),
		branch_code: value.slice(5),
	});
}

// ---------------------------------------------------------------------- UPI
// Common UPI handles (the part after `@`), exactly as the Rust core keeps
// them (crates/indycheck/src/data.rs). A handle that is missing or not in
// this list is INVALID_HANDLE; the name part is checked first and its
// failures are INVALID_FORMAT.
const UPI_HANDLES = new Set([
	'paytm', 'okaxis', 'okhdfcbank', 'okicici', 'oksbi', 'okbizaxis', 'ybl', 'axl',
	'ibl', 'upi', 'jio', 'aubank', 'freecharge', 'amazonpay', 'okbob', 'okpnb',
	'okciti', 'barodampay', 'cnrb', 'idfcfirst', 'kvb', 'rbl', 'sbi', 'hdfc',
	'icici', 'axis', 'kotak', 'yesbank', 'indus', 'federal', 'okyes', 'payzapp',
	'slice', 'gpay', 'phonepe', 'bhim',
]);

export function validateUpi(input, opts) {
	// The core does not strip spaces/hyphens or change case for UPI IDs —
	// it trims the input only. (So this validator deliberately does not
	// go through prepare().)
	const raw = String(input ?? '');
	const value = raw.trim();
	if (!value) return fail('upi', raw, 'EMPTY', 'UPI ID is empty.', 'UPI ID खाली है।');
	const parts = value.split('@');
	if (parts.length !== 2)
		return fail(
			'upi',
			raw,
			'INVALID_FORMAT',
			'UPI ID must be in name@handle format (e.g. name@okaxis).',
			'UPI ID name@handle प्रारूप में होनी चाहिए (जैसे name@okaxis)।',
		);
	const [name, handle] = parts;
	if (name.length < 2 || name.length > 50)
		return fail(
			'upi',
			raw,
			'INVALID_FORMAT',
			'UPI name must be 2-50 characters long.',
			'UPI नाम 2 से 50 अक्षरों का होना चाहिए।',
		);
	if (!/^[A-Za-z0-9.\-_]+$/.test(name))
		return fail(
			'upi',
			raw,
			'INVALID_FORMAT',
			'UPI name may only contain letters, digits, dot, hyphen or underscore.',
			'UPI नाम में केवल अक्षर, अंक, डॉट, हाइफ़न या अंडरस्कोर हो सकते हैं।',
		);
	if (!handle)
		return fail('upi', raw, 'INVALID_HANDLE', 'UPI handle is missing after @.', 'UPI हैंडल @ के बाद खाली है।');
	if (!UPI_HANDLES.has(handle.toLowerCase()))
		return fail(
			'upi',
			raw,
			'INVALID_HANDLE',
			'UPI handle is not a known handle.',
			'UPI हैंडल जाना-पहचाना हैंडल नहीं है।',
		);
	return pass('upi', raw, value, { handle: handle.toLowerCase() });
}

// ------------------------------------------------------------------- Mobile
// Normalise a mobile number the way the core does: strip spaces/hyphens,
// then remove a leading `+91`, `91` (12-digit form) or `0` (11-digit
// form). Returns the 10-digit string, or null when the result is not
// exactly 10 ASCII digits. The core reports any such failure as
// INVALID_FORMAT — it never emits INVALID_LENGTH for mobiles.
function normalizeMobileValue(raw, opts) {
	const o = resolveOptions(opts);
	const allowSpace = o.allowSpaces || SPACE_TOLERANT.has('mobile');
	const allowHyphen = o.allowHyphens || HYPHEN_TOLERANT.has('mobile');
	if (!allowSpace && /\s/.test(raw)) return null;
	if (!allowHyphen && raw.includes('-')) return null;
	let cleaned = raw.trim().replace(/[\s-]/g, '');
	if (!o.normalizeCountryCode) {
		return cleaned.length === 10 && isDigits(cleaned) ? cleaned : null;
	}
	const withoutPlus = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
	let digits = withoutPlus;
	if (withoutPlus.startsWith('91') && withoutPlus.length === 12) digits = withoutPlus.slice(2);
	else if (withoutPlus.startsWith('0') && withoutPlus.length === 11) digits = withoutPlus.slice(1);
	return digits.length === 10 && isDigits(digits) ? digits : null;
}

export function validateMobile(input, opts) {
	const raw = String(input ?? '');
	if (!raw.trim()) return fail('mobile', raw, 'EMPTY', 'Mobile number is empty.', 'मोबाइल नंबर खाली है।');
	const normalized = normalizeMobileValue(raw, opts);
	if (normalized === null)
		return fail('mobile', raw, 'INVALID_FORMAT', 'Mobile number must be 10 digits, optionally with +91, 91 or 0 prefix.', 'मोबाइल नंबर 10 अंकों का होना चाहिए, +91, 91 या 0 के साथ भी चलेगा।');
	if (!/^[6-9]/.test(normalized))
		return fail(
			'mobile',
			raw,
			'INVALID_FIRST_DIGIT',
			'Indian mobile numbers start with 6, 7, 8 or 9.',
			'भारतीय मोबाइल नंबर 6, 7, 8 या 9 से शुरू होते हैं।',
		);
	return pass('mobile', raw, normalized, { normalized });
}

// ------------------------------------------------------------------ PIN code
export function validatePincode(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('pincode', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('pincode', raw, 'EMPTY', 'PIN code is empty.', 'पिन कोड खाली है।');
	if (value.length !== 6)
		return fail('pincode', raw, 'INVALID_LENGTH', 'PIN code must be exactly 6 digits.', 'पिन कोड ठीक 6 अंकों का होना चाहिए।');
	if (!isDigits(value))
		return fail('pincode', raw, 'INVALID_FORMAT', 'PIN code must contain only digits.', 'पिन कोड में केवल अंक होने चाहिए।');
	if (value[0] === '0')
		return fail('pincode', raw, 'INVALID_FIRST_DIGIT', 'PIN code cannot start with 0.', 'पिन कोड 0 से शुरू नहीं हो सकता।');
	return pass('pincode', raw, value, { pincode: value });
}

export const VALIDATORS = {
	pan: validatePan,
	aadhaar: validateAadhaar,
	gstin: validateGstin,
	ifsc: validateIfsc,
	upi: validateUpi,
	mobile: validateMobile,
	pincode: validatePincode,
	tan: validateTan,
	cin: validateCin,
	llpin: validateLlpin,
	epic: validateEpic,
	vehicle: validateVehicle,
};

export function validate(type, value, opts) {
	const fn = VALIDATORS[type];
	if (!fn) return fail(type, String(value ?? ''), 'UNKNOWN_TYPE', `Unknown validator type "${type}".`, `अज्ञात वैलिडेटर प्रकार "${type}"।`);
	return fn(value, opts);
}

// ---------------------------------------------------------------------- TAN
// Tax Deduction and Collection Account Number: 4 letters + 5 digits +
// 1 letter. The last letter is a system-generated check character, but
// there is NO public checksum algorithm — so this is FORMAT ONLY.
export function validateTan(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('tan', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('tan', raw, 'EMPTY', 'TAN is empty.', 'TAN खाली है।');
	if (value.length !== 10)
		return fail('tan', raw, 'INVALID_LENGTH', 'TAN must be exactly 10 characters.', 'TAN ठीक 10 अक्षरों का होना चाहिए।');
	if (!/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(value))
		return fail(
			'tan',
			raw,
			'INVALID_FORMAT',
			'TAN must look like MUMB12345C — 4 letters, 5 digits, 1 letter.',
			'TAN का प्रारूप MUMB12345C जैसा होना चाहिए — 4 अक्षर, 5 अंक, 1 अक्षर।',
		);
	return pass('tan', raw, value, { tan: value });
}

// ---------------------------------------------------------------------- CIN
// Corporate Identification Number: 21 characters —
// L/U (listed/unlisted) + 5 industry digits + 2-letter state code +
// 4-digit year + 3-letter company type + 6-digit registration number.
// No public checksum — FORMAT ONLY.
export function validateCin(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('cin', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('cin', raw, 'EMPTY', 'CIN is empty.', 'CIN खाली है।');
	if (value.length !== 21)
		return fail('cin', raw, 'INVALID_LENGTH', 'CIN must be exactly 21 characters.', 'CIN ठीक 21 अक्षरों का होना चाहिए।');
	if (value[0] !== 'L' && value[0] !== 'U')
		return fail(
			'cin',
			raw,
			'INVALID_FORMAT',
			'CIN must start with L (listed) or U (unlisted).',
			'CIN L (सूचीबद्ध) या U (गैर-सूचीबद्ध) से शुरू होना चाहिए।',
		);
	if (!/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(value))
		return fail(
			'cin',
			raw,
			'INVALID_FORMAT',
			'CIN must look like U12345DL2025PTC123456 — letter, 5 digits, 2-letter state, 4-digit year, 3 letters, 6 digits.',
			'CIN का प्रारूप U12345DL2025PTC123456 जैसा होना चाहिए — अक्षर, 5 अंक, 2 अक्षरों का राज्य, 4 अंकों का वर्ष, 3 अक्षर, 6 अंक।',
		);
	return pass('cin', raw, value, {
		cin: value,
		listing: value[0] === 'L' ? 'Listed' : 'Unlisted',
		industry_code: value.slice(1, 6),
		state_code: value.slice(6, 8),
		year: value.slice(8, 12),
		company_type: value.slice(12, 15),
		registration_number: value.slice(15),
	});
}

// -------------------------------------------------------------------- LLPIN
// LLP Identification Number: 3 letters + 4 digits (7 characters),
// usually written AAA-1234. The hyphen is a display separator and is
// accepted even in strict mode. No public checksum — FORMAT ONLY.
export function validateLlpin(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('llpin', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('llpin', raw, 'EMPTY', 'LLPIN is empty.', 'LLPIN खाली है।');
	if (value.length !== 7)
		return fail('llpin', raw, 'INVALID_LENGTH', 'LLPIN must be exactly 7 characters (3 letters + 4 digits).', 'LLPIN ठीक 7 अक्षरों का होना चाहिए (3 अक्षर + 4 अंक)।');
	if (!/^[A-Z]{3}[0-9]{4}$/.test(value))
		return fail(
			'llpin',
			raw,
			'INVALID_FORMAT',
			'LLPIN must look like AAA-1234 — 3 letters, then 4 digits.',
			'LLPIN का प्रारूप AAA-1234 जैसा होना चाहिए — 3 अक्षर, फिर 4 अंक।',
		);
	return pass('llpin', raw, value, { llpin: value });
}

// --------------------------------------------------------------------- EPIC
// Voter ID (Electors Photo Identity Card): 3 letters + 7 digits in the
// current series. Older cards used different formats (including slashes)
// — those are rejected; this validator covers the current series only.
// No public checksum — FORMAT ONLY.
export function validateEpic(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('epic', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('epic', raw, 'EMPTY', 'Voter ID (EPIC) is empty.', 'वोटर ID (EPIC) खाली है।');
	if (value.length !== 10)
		return fail('epic', raw, 'INVALID_LENGTH', 'Voter ID (EPIC) must be exactly 10 characters.', 'वोटर ID (EPIC) ठीक 10 अक्षरों का होना चाहिए।');
	if (!/^[A-Z]{3}[0-9]{7}$/.test(value))
		return fail(
			'epic',
			raw,
			'INVALID_FORMAT',
			'Voter ID (EPIC) must look like ABC1234567 — 3 letters, then 7 digits. Older cards with slashes are a legacy format and are not accepted.',
			'वोटर ID (EPIC) का प्रारूप ABC1234567 जैसा होना चाहिए — 3 अक्षर, फिर 7 अंक। स्लैश वाले पुराने कार्ड लेगेसी प्रारूप हैं और स्वीकार नहीं किए जाते।',
		);
	return pass('epic', raw, value, { epic: value });
}

// ------------------------------------------------------------------ Vehicle
// Indian vehicle registration, exactly as the Rust core checks it
// (crates/indycheck/src/vehicle.rs): two shapes since v0.2.0 —
// state format: 2 state-code letters + 1–2 digit district + 1–2 letter
// series + 1–4 digit number (8–10 chars), and Bharat (BH) series:
// YYBH####XX, year 21+, number 0001–9999, suffix excludes I/O.
// Spaces/hyphens stripped first. Format only — the 2-letter state code
// is NOT checked against a list of states, state series letters may be
// I or O, and there is no checksum.
export function validateVehicle(input, opts) {
	const raw = String(input ?? '');
	const prep = prepare('vehicle', raw, opts);
	if (prep.error) return prep.error;
	const value = prep.value;
	if (!value) return fail('vehicle', raw, 'EMPTY', 'Vehicle number is empty.', 'वाहन नंबर खाली है।');
	if (value.length < 8 || value.length > 10)
		return fail(
			'vehicle',
			raw,
			'INVALID_LENGTH',
			'Vehicle number must be 8–10 characters (e.g. DL01AB1234).',
			'वाहन नंबर 8–10 अक्षरों का होना चाहिए (जैसे DL01AB1234)।',
		);
	// Bharat (BH) series: starts with 2 digits (the registration year),
	// so check it before the state format, which needs 2 leading letters.
	if (/^[0-9]{2}/.test(value)) return validateBharatVehicle(raw, value);
	if (!/^[A-Z]{2}/.test(value))
		return fail(
			'vehicle',
			raw,
			'INVALID_FORMAT',
			'Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234).',
			'वाहन नंबर 2 राज्य-कोड अक्षरों से शुरू होना चाहिए (जैसे DL01AB1234)।',
		);
	// Parse: district digits (1-2), series letters (1-2), number digits (1-4).
	let i = 2;
	const districtStart = i;
	while (i < value.length && /[0-9]/.test(value[i]) && i - districtStart < 2) i++;
	const district = value.slice(districtStart, i);
	const seriesStart = i;
	while (i < value.length && /[A-Z]/.test(value[i]) && i - seriesStart < 2) i++;
	const series = value.slice(seriesStart, i);
	const numberStart = i;
	while (i < value.length && /[0-9]/.test(value[i]) && i - numberStart < 4) i++;
	const number = value.slice(numberStart, i);
	if (!district || !series || !number || i !== value.length)
		return fail(
			'vehicle',
			raw,
			'INVALID_FORMAT',
			'Vehicle registration format must be state letters + district digits + series letters + number digits (e.g. DL01AB1234). Registration numbers have no checksum, so only the format is checked.',
			'वाहन नंबर का प्रारूप राज्य अक्षर + ज़िला अंक + सीरीज़ अक्षर + नंबर अंक होना चाहिए (जैसे DL01AB1234)। वाहन नंबर का कोई चेकसम नहीं है, इसलिए केवल प्रारूप जाँचा जाता है।',
		);
	return pass('vehicle', raw, value, {
		registration: value,
		series_type: 'state',
		state_code: value.slice(0, 2),
		district,
		series,
		number,
	});
}

// Bharat (BH) series: `YYBH####XX` — mirror of validate_bharat in
// crates/indycheck/src/vehicle.rs. Called only when the cleaned input
// starts with 2 digits.
function validateBharatVehicle(raw, value) {
	const notBharat = (en, hi) => fail('vehicle', raw, 'INVALID_FORMAT', en, hi);
	// Shape: exactly 10 chars, `BH` at 2–3, 4 digits, 2 letters.
	const shapeOk =
		value.length === 10 &&
		value.slice(2, 4) === 'BH' &&
		/^[0-9]{4}$/.test(value.slice(4, 8)) &&
		/^[A-Z]{2}$/.test(value.slice(8, 10));
	if (!shapeOk)
		return notBharat(
			'Vehicle registration number must start with 2 state-code letters (e.g. DL01AB1234), or be a Bharat series number (e.g. 22BH1234AA)',
			'वाहन नंबर 2 राज्य-कोड अक्षरों से शुरू होना चाहिए (जैसे DL01AB1234), या भारत सीरीज़ नंबर होना चाहिए (जैसे 22BH1234AA)',
		);
	const year = value.slice(0, 2);
	if (Number(year) < 21)
		return notBharat(
			'Bharat (BH) series numbers start from 2021 — the year must be 21 or later (e.g. 22BH1234AA)',
			'Bharat (BH) series number 2021 se shuru hue hain — saal 21 ya usse baad ka hona chahiye (jaise 22BH1234AA)',
		);
	const number = value.slice(4, 8);
	if (number === '0000')
		return notBharat(
			'Bharat (BH) series number must be 0001-9999 (e.g. 22BH1234AA)',
			'Bharat (BH) series number 0001 se 9999 ke beech hona chahiye (jaise 22BH1234AA)',
		);
	const suffix = value.slice(8, 10);
	if (suffix.includes('I') || suffix.includes('O'))
		return notBharat(
			'Bharat (BH) series suffix letters cannot be I or O (e.g. 22BH1234AA)',
			'Bharat (BH) series ke aakhiri akshar I ya O nahi ho sakte (jaise 22BH1234AA)',
		);
	return pass('vehicle', raw, value, {
		registration: value,
		series_type: 'bharat',
		year,
		series: 'BH',
		number,
		suffix,
	});
}

// ---------------------------------------------------------- masking & format
// Masking helpers: safe to display/log. They return null unless the value
// is valid — never mask a value you have not validated.
export function maskAadhaar(value) {
	const r = validateAadhaar(value);
	return r.ok ? r.parsed.masked : null;
}
export function maskPan(value) {
	const r = validatePan(value);
	// Core mask_pan: first 5 chars + **** + last char (e.g. AAAPL****C).
	return r.ok ? `${r.normalized.slice(0, 5)}****${r.normalized[9]}` : null;
}
export function maskMobile(value) {
	const r = validateMobile(value);
	return r.ok ? `******${r.normalized.slice(6)}` : null;
}
export function maskGstin(value) {
	const r = validateGstin(value);
	return r.ok ? `${r.normalized.slice(0, 2)}**********${r.normalized.slice(12)}` : null;
}
export function maskUpi(value) {
	const r = validateUpi(value);
	return r.ok ? `***@${r.parsed.handle}` : null;
}
export function maskTan(value) {
	const r = validateTan(value);
	return r.ok ? `${r.normalized.slice(0, 2)}******${r.normalized.slice(8)}` : null;
}
export function maskEpic(value) {
	const r = validateEpic(value);
	return r.ok ? `${r.normalized.slice(0, 3)}***${r.normalized.slice(6)}` : null;
}

export function mask(type, value) {
	const fns = {
		aadhaar: maskAadhaar, pan: maskPan, mobile: maskMobile,
		gstin: maskGstin, upi: maskUpi, tan: maskTan, epic: maskEpic,
	};
	const fn = fns[type];
	return fn ? fn(value) : null;
}

// Formatting helpers: display forms. Return null unless the value is valid.
export function formatAadhaar(value) {
	const r = validateAadhaar(value);
	return r.ok ? r.normalized.replace(/(\d{4})(?=\d)/g, '$1 ') : null;
}
export function formatMobile(value) {
	const r = validateMobile(value);
	return r.ok ? `+91 ${r.normalized.slice(0, 5)} ${r.normalized.slice(5)}` : null;
}
export function formatVehicle(value) {
	const r = validateVehicle(value);
	if (!r.ok) return null;
	if (r.parsed.series_type === 'bharat')
		return `${r.parsed.year} ${r.parsed.series} ${r.parsed.number} ${r.parsed.suffix}`;
	return `${r.parsed.state_code} ${r.parsed.district} ${r.parsed.series} ${r.parsed.number}`;
}
export function formatPan(value) {
	const r = validatePan(value);
	return r.ok ? r.normalized : null;
}
export function formatLlpin(value) {
	const r = validateLlpin(value);
	return r.ok ? `${r.normalized.slice(0, 3)}-${r.normalized.slice(3)}` : null;
}

export function format(type, value) {
	const fns = {
		aadhaar: formatAadhaar, mobile: formatMobile, vehicle: formatVehicle,
		pan: formatPan, llpin: formatLlpin,
	};
	const fn = fns[type];
	return fn ? fn(value) : null;
}

// ------------------------------------------------------- test-data generators
// TEST DATA ONLY. These generate syntactically valid values for tests,
// demos and seed data. They are NOT real IDs, must never be presented as
// real, and must never be used to impersonate anyone. Every generated
// value passes its validator by construction (verified in tests).
function randLetters(n) {
	const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
	let s = '';
	for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
	return s;
}
function randDigits(n, firstNonZero = false) {
	let s = '';
	for (let i = 0; i < n; i++) {
		s += String(i === 0 && firstNonZero ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10));
	}
	return s;
}
function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePan() {
	return `${randLetters(3)}${pick(Object.keys(PAN_ENTITY_NAMES))}${randLetters(1)}${randDigits(4)}${randLetters(1)}`;
}
export function generateAadhaar() {
	const first11 = `${2 + Math.floor(Math.random() * 8)}${randDigits(10)}`;
	for (let d = 0; d <= 9; d++) {
		if (verhoeffValid(first11 + d)) return first11 + d;
	}
	return first11 + '0'; // unreachable: a Verhoeff check digit always exists
}
export function generateGstin() {
	const state = pick(Object.keys(GSTIN_STATES));
	const pan = generatePan();
	const first14 = `${state}${pan}${1 + Math.floor(Math.random() * 9)}Z`;
	return first14 + gstinCheckChar(first14);
}
export function generateIfsc() {
	const banks = ['SBIN', 'HDFC', 'ICIC', 'PUNB', 'BARB', 'CNRB', 'UBIN', 'IOBA'];
	const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
	let branch = '';
	for (let i = 0; i < 6; i++) branch += chars[Math.floor(Math.random() * chars.length)];
	return `${pick(banks)}0${branch}`;
}
export function generateUpi() {
	const banks = ['paytm', 'okicici', 'okhdfcbank', 'okaxis', 'ybl', 'axl'];
	const handle = Math.random() < 0.5 ? generateMobile() : `user${randDigits(4)}`;
	return `${handle}@${pick(banks)}`;
}
export function generateMobile() {
	return `${6 + Math.floor(Math.random() * 4)}${randDigits(9)}`;
}
export function generatePincode() {
	return `${1 + Math.floor(Math.random() * 9)}${randDigits(5)}`;
}
export function generateTan() {
	return `${randLetters(4)}${randDigits(5)}${randLetters(1)}`;
}
export function generateCin() {
	const states = ['DL', 'MH', 'KA', 'TN', 'WB', 'GJ', 'UP', 'AP', 'TS', 'KL'];
	const year = String(1995 + Math.floor(Math.random() * 32));
	return `${pick(['U', 'L'])}${randDigits(5)}${pick(states)}${year}${pick(['PTC', 'PLC', 'OPC', 'NPL', 'GPC', 'FTC'])}${randDigits(6)}`;
}
export function generateLlpin() {
	return `${randLetters(3)}-${randDigits(4)}`;
}
export function generateEpic() {
	return `${randLetters(3)}${randDigits(7)}`;
}
export function generateVehicle() {
	const states = ['DL', 'MH', 'KA', 'AS', 'WB', 'UP', 'GJ', 'TN', 'HR', 'PB'];
	return `${pick(states)}${String(1 + Math.floor(Math.random() * 99)).padStart(2, '0')}${randLetters(Math.random() < 0.5 ? 1 : 2)}${randDigits(4)}`;
}

export const GENERATORS = {
	pan: generatePan,
	aadhaar: generateAadhaar,
	gstin: generateGstin,
	ifsc: generateIfsc,
	upi: generateUpi,
	mobile: generateMobile,
	pincode: generatePincode,
	tan: generateTan,
	cin: generateCin,
	llpin: generateLlpin,
	epic: generateEpic,
	vehicle: generateVehicle,
};

export function generate(type) {
	const fn = GENERATORS[type];
	return fn ? fn() : null;
}

// --------------------------------------------------------------------- detect
// Guess the type of an unknown value, in exactly the order the Rust core
// uses (crates/indycheck/src/lib.rs `detect()`):
//   1. anything containing `@` → upi
//   2. a 12-digit Verhoeff-valid number (spaces/hyphens ignored) → aadhaar
//   3. a normalisable mobile number → mobile (this wins over the
//      length-15 GSTIN branch, e.g. "+91 98765 43210" is 15 chars long)
//   4. a 21-char CIN pattern → cin
//   5. by length: 15 → gstin; 12 digits → aadhaar; 11 IFSC pattern → ifsc;
//      10 PAN pattern → pan; 10 TAN pattern → tan; 10 voter pattern →
//      voter; 10 digits → mobile; 7 LLPIN pattern → llpin;
//      6 digits → pincode
//   6. a normalisable mobile (formatted form) → mobile
//   7. PAN / TAN / voter / IFSC / LLPIN patterns, then vehicle pattern
//   8. anything else → unknown
// detect() returns the matching validator's full result, or an
// UNKNOWN_TYPE result when nothing fits. (The core's detect() itself
// returns just the type string; validate_many() turns an unknown type
// into the UNKNOWN_TYPE code.)
const isPanPattern = (s) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s);
const isTanPattern = (s) => /^[A-Z]{4}[0-9]{5}[A-Z]$/.test(s);
const isVoterPattern = (s) => /^[A-Z]{3}[0-9]{7}$/.test(s);
const isIfscPattern = (s) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s);
const isLlpinPattern = (s) => /^[A-Z]{3}[0-9]{4}$/.test(s);
const isCinPattern = (s) => /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(s);

function detectType(raw, opts) {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) return 'unknown';
	if (trimmed.includes('@')) return 'upi';
	const upper = trimmed.toUpperCase();
	const len = [...trimmed].length;
	const allDigits = /^[0-9]+$/.test(trimmed);
	if (len === 12 && allDigits && verhoeffValid(trimmed)) return 'aadhaar';
	const digitsOnly = trimmed.replace(/[^0-9]/g, '');
	if (digitsOnly.length === 12 && verhoeffValid(digitsOnly)) return 'aadhaar';
	if (normalizeMobileValue(trimmed, opts) !== null) return 'mobile';
	if (len === 21 && isCinPattern(upper)) return 'cin';
	if (len === 15) return 'gstin';
	if (len === 12 && allDigits) return 'aadhaar';
	if (len === 11 && isIfscPattern(upper)) return 'ifsc';
	if (len === 10 && isPanPattern(upper)) return 'pan';
	if (len === 10 && isTanPattern(upper)) return 'tan';
	if (len === 10 && isVoterPattern(upper)) return 'voter';
	if (len === 10 && allDigits) return 'mobile';
	if (len === 7 && isLlpinPattern(upper)) return 'llpin';
	if (len === 6 && allDigits) return 'pincode';
	if (normalizeMobileValue(trimmed, opts) !== null) return 'mobile';
	if (isPanPattern(upper)) return 'pan';
	if (isTanPattern(upper)) return 'tan';
	if (isVoterPattern(upper)) return 'voter';
	if (isIfscPattern(upper)) return 'ifsc';
	if (isLlpinPattern(upper)) return 'llpin';
	if (validateVehicle(trimmed, opts).ok) return 'vehicle';
	return 'unknown';
}

export function detect(value, opts) {
	const type = detectType(value, opts);
	if (type === 'unknown') {
		return {
			ok: false,
			type: null,
			value: String(value ?? ''),
			code: 'UNKNOWN_TYPE',
			reason_en: 'This value does not match any known Indian ID format.',
			reason_hi: 'यह मान किसी भी ज्ञात भारतीय ID प्रारूप से मेल नहीं खाता।',
		};
	}
	// The core's detect() returns "voter"; the JS table calls it "epic".
	return VALIDATORS[type === 'voter' ? 'epic' : type](value, opts);
}
