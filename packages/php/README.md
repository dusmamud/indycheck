# indycheck — PHP binding

> **Distribution note:** This package lives in the main repo
> [`dusmamud/indycheck`](https://github.com/dusmamud/indycheck)
> (`packages/php/`) and is mirrored to the auto-synced split repo
> [`dusmamud/indycheck-php`](https://github.com/dusmamud/indycheck-php),
> the repository for Packagist distribution as
> [`dusmamud/indycheck`](https://packagist.org/packages/dusmamud/indycheck).
> Make changes in the main repo — they are synced automatically.
> Do not edit files in the split repo directly.

PHP binding for [indycheck](https://github.com/dusmamud/indycheck), the
offline Indian ID validator (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile,
PIN code, TAN, CIN, LLPIN, Voter ID / EPIC, vehicle registration —
including Bharat (BH) series numbers such as `22BH1234AA`).

It is a thin [FFI](https://www.php.net/manual/en/book.ffi.php) binding
over the C API in `crates/indycheck-ffi`, which itself is a thin
wrapper over the Rust core in `crates/indycheck`. **No validation
logic lives in this package** — every function calls the matching C
function and decodes the JSON result it returns, so PHP returns the
same answer as Rust for the same input.

This is the FFI tier only. A compiled PHP extension (PIE) is a later
tier and is not part of this package.

## Prerequisites

- PHP 8.1 or later (tested on 8.2 and 8.3)
- The FFI extension (`ext-ffi`) with `ffi.enable=true` — see below
- `ext-json` (bundled with PHP)
- A Rust toolchain (`cargo`) and a C compiler (`gcc`) — needed once,
  to build the shared library this package calls into

## Install

Install it from Packagist:

```bash
composer require dusmamud/indycheck
```

For an unreleased change, install it from the repo instead — either
as a path repository or a VCS repository:

```json
{
    "repositories": [
        {
            "type": "vcs",
            "url": "https://github.com/dusmamud/indycheck"
        }
    ],
    "require": {
        "dusmamud/indycheck": "^0.2"
    }
}
```

Or, from a local checkout of the repo, point Composer at the package
directory with a `path` repository (`packages/php`).

## Enabling FFI (`ffi.enable=true`)

PHP ships FFI disabled by default (`ffi.enable=preload`), which only
allows `FFI::cdef()` inside preload scripts — not how this package
runs. You need `ffi.enable=true`, and it is a `PHP_INI_SYSTEM`
setting, so **`ini_set()` cannot change it**.

**CLI** — add to `php.ini`:

```ini
ffi.enable=true
```

or pass it on the command line when running a script or the tests:

```sh
php -d ffi.enable=true vendor/bin/phpunit
```

**PHP-FPM** — the FPM pool config wins over `php.ini` for this
setting, so add to the pool config (e.g. `/etc/php/8.3/fpm/pool.d/www.conf`):

```ini
php_admin_value[ffi.enable]=true
```

then restart PHP-FPM:

```sh
sudo systemctl restart php8.3-fpm
```

(A plain `ffi.enable=true` in `php.ini` works for FPM too, as long as
the pool does not override it — but `php_admin_value` is the reliable
route.)

**CLI vs FPM:** they can use different `php.ini` files. If the
package works on the command line but not under FPM (or the other
way round), check `php -i | grep ffi.enable` for CLI and a
`phpinfo()` page for FPM separately. `php scripts/setup.php` checks
the setup for whichever PHP binary runs it.

## Getting the native library

The `.so` / `.dylib` / `.dll` is a build artefact, not a source: it
is never committed to the repo. Build it once, from the repo root:

```sh
cargo build -p indycheck-ffi --release
```

That produces `target/release/libindycheck_ffi.so` (Linux),
`target/release/libindycheck_ffi.dylib` (macOS) or
`target/release/indycheck_ffi.dll` (Windows).

The package finds the library in this order:

1. The `INDYCHECK_LIB_PATH` environment variable (full path to the file)
2. `vendor/dusmamud/indycheck/lib/<platform file>` (Composer install)
3. `<package>/lib/<platform file>` (vendored next to the package)
4. `<repo root>/target/release/<platform file>` (cargo build)
5. `<repo root>/target/debug/<platform file>`

Run `php scripts/setup.php` to check the whole setup — PHP version,
ext-ffi, `ffi.enable`, ext-json, and whether the library was found:

```sh
php scripts/setup.php
# or, if php.ini does not enable FFI yet:
php -d ffi.enable=true scripts/setup.php
```

It exits 0 when everything is OK, 1 otherwise.

## Usage

```php
use Indycheck\Indycheck;

$result = Indycheck::validatePan('ABCDE1234F');
if ($result['valid']) {
    echo $result['code'];              // VALID
    echo $result['parsed']['entity'];  // Individual
} else {
    echo $result['code'];      // e.g. INVALID_FORMAT
    echo $result['reason_en'];
    echo $result['reason_hi'];
}

// Bharat (BH) series vehicle number
$v = Indycheck::validateVehicle('22BH1234AA');
var_dump($v['valid'], $v['parsed']['series_type'], $v['parsed']['year']);

// Detect the type first, then validate a batch in one call
$t = Indycheck::detect('9876543210'); // "mobile"
$batch = Indycheck::validateMany(['ABCDE1234F', '9876543210', 'nope']);
// $batch[0]['valid'] === true, $batch[1]['valid'] === true, $batch[2]['valid'] === false
```

## API

Every validator returns an associative array with the same shape as
the JSON the Rust core returns. `parsed` is present only on success.

```php
[
    'valid'     => bool,   // true when the input is valid
    'code'      => string, // 'VALID' on success, otherwise a stable error code
    'reason_en' => string, // human-readable reason (English)
    'reason_hi' => string, // human-readable reason (Hindi)
    'parsed'    => array,  // extracted fields — present only on success
]
```

A failed validation is a normal return value (`'valid' => false`),
never an exception. A `RuntimeException` means a transport problem
only: the native library cannot be found, ext-ffi is disabled or
`ffi.enable` is not `true`, or a native call returned something that
could not be decoded.

| Method | Validates |
|---|---|
| `Indycheck::validatePan(string $input): array` | PAN, e.g. `ABCDE1234F` |
| `Indycheck::validateAadhaar(string $input): array` | 12-digit Aadhaar (Verhoeff checksum) |
| `Indycheck::validateGstin(string $input): array` | 15-character GSTIN |
| `Indycheck::validateMobile(string $input): array` | Indian mobile (`+91` / `91` / `0` prefix, spaces/hyphens OK) |
| `Indycheck::validateVehicle(string $input): array` | State format (`DL01AB1234`) or Bharat series (`22BH1234AA`) |
| `Indycheck::validateVehicleRegistration(string $input): array` | Alias for `validateVehicle` |
| `Indycheck::validateIfsc(string $input): array` | IFSC (11 characters) |
| `Indycheck::validateUpi(string $input): array` | UPI ID (`name@handle`) |
| `Indycheck::validatePincode(string $input): array` | 6-digit PIN code |
| `Indycheck::validateTan(string $input): array` | TAN (format only) |
| `Indycheck::validateCin(string $input): array` | CIN (format only) |
| `Indycheck::validateLlpin(string $input): array` | LLPIN |
| `Indycheck::validateVoterId(string $input): array` | Voter ID / EPIC |
| `Indycheck::validateEpic(string $input): array` | Alias for `validateVoterId` |
| `Indycheck::detect(string $input): string` | Returns the type string (`"pan"`, `"mobile"`, `"vehicle"`, …, `"unknown"`) |
| `Indycheck::validateMany(array $inputs): array` | Batch: validates each input, results in input order |
| `Indycheck::version(): string` | Core version string, e.g. `"0.2.2"` |
| `Indycheck::generatePan(string $entity = 'P'): string` | Test-data PAN |
| `Indycheck::generateAadhaar(): string` | Test-data Aadhaar |
| `Indycheck::generateGstin(string $stateCode = '18'): string` | Test-data GSTIN |
| `Indycheck::generateMobile(): string` | Test-data mobile number |
| `Indycheck::generateVehicle(): string` | Test-data state-format vehicle number |
| `Indycheck::generateVehicleBharat(): string` | Test-data Bharat (BH) vehicle number |

## Generators are test data only

The `generate*()` methods produce syntactically valid values for
testing — they are **not real issued numbers** and must never be
presented as belonging to a real person, business, or vehicle. A
generated PAN is not anyone's PAN, a generated Aadhaar is not
anyone's Aadhaar, and a generated vehicle number is not a real
registration.

## Tests

```sh
composer install
cargo build -p indycheck-ffi --release
INDYCHECK_LIB_PATH=/path/to/libindycheck_ffi.so php -d ffi.enable=true vendor/bin/phpunit --testdox
# or: composer test        (same phpunit run; add -d ffi.enable=true as above)
```

## Honest limits

Same as the core: this checks format and, where one exists, checksum
only. It does **not** verify that an ID really exists or belongs to
anyone — that needs UIDAI / NSDL / GSTN / RBI, which this library
never contacts. It makes no network calls at all.
