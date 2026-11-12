<?php

declare(strict_types=1);

namespace Indycheck;

use FFI;
use JsonException;
use RuntimeException;

/**
 * Static FFI binding for indycheck — offline validator for Indian IDs.
 *
 * Every validator returns an associative array with the same shape as the
 * JSON the Rust core returns:
 *
 *   [
 *     'valid'     => bool,   // true when the input is valid
 *     'code'      => string, // 'VALID' on success, otherwise a stable error code
 *     'reason_en' => string, // human-readable reason (English)
 *     'reason_hi' => string, // human-readable reason (Hindi)
 *     'parsed'    => array,  // extracted fields — present only on success
 *   ]
 *
 * A failed validation is a normal return value (`'valid' => false`),
 * never an exception. Exceptions are only for transport problems:
 * the native library cannot be found, ext-ffi is disabled, or the
 * native call returns something that cannot be decoded.
 *
 * No validation logic lives in this class — every call goes through
 * the C API in crates/indycheck-ffi, which is a thin wrapper over the
 * Rust core, so PHP returns the same answer as Rust for the same input.
 *
 * This is the FFI tier only. It needs the PHP FFI extension
 * (`ext-ffi`) with `ffi.enable=true`, plus the compiled native
 * library. See packages/php/README.md for setup.
 */
final class Indycheck
{
    /**
     * C declarations for crates/indycheck-ffi/indycheck.h, copied
     * faithfully (char* returns, const char* params, void return for
     * indycheck_free_string). Every function returning char* returns a
     * heap string owned by the caller — freed with
     * indycheck_free_string(), always inside try/finally.
     */
    private const CDEF = <<<'C'
        char *indycheck_validate_pan(const char *input);
        char *indycheck_validate_aadhaar(const char *input);
        char *indycheck_validate_gstin(const char *input);
        char *indycheck_validate_mobile(const char *input);
        char *indycheck_validate_vehicle(const char *input);
        char *indycheck_validate_vehicle_registration(const char *input);
        char *indycheck_validate_ifsc(const char *input);
        char *indycheck_validate_upi(const char *input);
        char *indycheck_validate_pincode(const char *input);
        char *indycheck_validate_tan(const char *input);
        char *indycheck_validate_cin(const char *input);
        char *indycheck_validate_llpin(const char *input);
        char *indycheck_validate_voter_id(const char *input);
        char *indycheck_validate_epic(const char *input);
        char *indycheck_detect(const char *input);
        char *indycheck_validate_many(const char *inputs_json);
        char *indycheck_generate_pan(const char *entity);
        char *indycheck_generate_aadhaar(void);
        char *indycheck_generate_gstin(const char *state_code);
        char *indycheck_generate_mobile(void);
        char *indycheck_generate_vehicle(void);
        char *indycheck_generate_vehicle_bharat(void);
        char *indycheck_version(void);
        void indycheck_free_string(char *ptr);
        C;

    private static ?FFI $ffi = null;

    private function __construct()
    {
    }

    // -- Validators -----------------------------------------------------

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validatePan(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_pan($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateAadhaar(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_aadhaar($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateGstin(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_gstin($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateMobile(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_mobile($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateVehicle(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_vehicle($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateVehicleRegistration(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_vehicle_registration($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateIfsc(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_ifsc($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateUpi(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_upi($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validatePincode(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_pincode($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateTan(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_tan($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateCin(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_cin($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateLlpin(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_llpin($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateVoterId(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_voter_id($input),
        ));
    }

    /** @return array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array} */
    public static function validateEpic(string $input): array
    {
        return self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_epic($input),
        ));
    }

    // -- Detect / batch / version ---------------------------------------

    /**
     * Detect the type of an Indian ID string. Returns one of
     * 'pan', 'aadhaar', 'gstin', 'ifsc', 'upi', 'mobile', 'pincode',
     * 'tan', 'cin', 'llpin', 'voter', 'vehicle' or 'unknown'.
     */
    public static function detect(string $input): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_detect($input),
        );
    }

    /**
     * Validate many inputs in one call. Results come back in the same
     * order as the inputs.
     *
     * @param string[] $inputs
     * @return array<int, array{valid: bool, code: string, reason_en: string, reason_hi: string, parsed?: array}>
     */
    public static function validateMany(array $inputs): array
    {
        try {
            $json = json_encode($inputs, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('Could not encode inputs as JSON: ' . $e->getMessage(), 0, $e);
        }

        $decoded = self::decodeResult(self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_validate_many($json),
        ));

        if (!array_is_list($decoded)) {
            throw new RuntimeException('indycheck_validate_many returned unexpected JSON (expected an array of results).');
        }

        return $decoded;
    }

    /** Core version string, e.g. '0.2.2'. */
    public static function version(): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_version(),
        );
    }

    // -- Test-data generators -------------------------------------------
    //
    // These produce syntactically valid values for testing only — they
    // are NOT real issued numbers and must never be presented as such.

    /** Generate a syntactically valid PAN. $entity is the entity character ('P' for Individual, 'C' for Company, …). */
    public static function generatePan(string $entity = 'P'): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_generate_pan($entity),
        );
    }

    /** Generate a syntactically valid 12-digit Aadhaar number (correct Verhoeff check digit). */
    public static function generateAadhaar(): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_generate_aadhaar(),
        );
    }

    /** Generate a syntactically valid GSTIN for the given 2-digit state code ('18' is the default). */
    public static function generateGstin(string $stateCode = '18'): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_generate_gstin($stateCode),
        );
    }

    /** Generate a syntactically valid Indian mobile number (10 digits, first digit 6-9). */
    public static function generateMobile(): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_generate_mobile(),
        );
    }

    /** Generate a syntactically valid state-format vehicle number, e.g. 'DL01AB1234'. */
    public static function generateVehicle(): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_generate_vehicle(),
        );
    }

    /** Generate a syntactically valid Bharat (BH) series vehicle number, e.g. '22BH1234AA'. */
    public static function generateVehicleBharat(): string
    {
        return self::callString(
            static fn (FFI $ffi) => $ffi->indycheck_generate_vehicle_bharat(),
        );
    }

    // -- Internals ------------------------------------------------------

    /**
     * Run one native call that returns a heap char*, convert it to a
     * PHP string, and always free the native string — even when the
     * conversion itself throws.
     */
    private static function callString(callable $call): string
    {
        $ffi = self::ffi();
        $ptr = $call($ffi);

        if ($ptr === null) {
            throw new RuntimeException('indycheck native call returned NULL.');
        }

        try {
            return FFI::string($ptr);
        } finally {
            $ffi->indycheck_free_string($ptr);
        }
    }

    /** Decode one validator's JSON result, or throw on bad JSON. */
    private static function decodeResult(string $json): array
    {
        try {
            $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('indycheck returned invalid JSON: ' . $e->getMessage(), 0, $e);
        }

        if (!is_array($decoded)) {
            throw new RuntimeException('indycheck returned unexpected JSON (expected an object).');
        }

        return $decoded;
    }

    /**
     * The shared FFI instance, built once. Throws a clear
     * RuntimeException when ext-ffi is missing/disabled or the native
     * library cannot be found.
     */
    private static function ffi(): FFI
    {
        if (self::$ffi !== null) {
            return self::$ffi;
        }

        if (!extension_loaded('ffi') || !class_exists(FFI::class)) {
            throw new RuntimeException(
                'The indycheck PHP package needs the FFI extension (ext-ffi). '
                . 'Enable it in your PHP build and set ffi.enable=true in php.ini '
                . '(see packages/php/README.md).',
            );
        }

        // ini_get() returns '1' for ffi.enable=true set in php.ini or
        // with -d, and 'preload' for the PHP default. Only 'true' lets
        // FFI::cdef() run outside a preload script, so anything else
        // is a configuration error, not a runtime surprise.
        $ffiEnable = ini_get('ffi.enable');
        if ($ffiEnable !== '1' && $ffiEnable !== 'true') {
            throw new RuntimeException(
                "The indycheck PHP package needs ffi.enable=true, but it is currently '{$ffiEnable}'. "
                . 'ffi.enable is a PHP_INI_SYSTEM setting, so it cannot be changed with ini_set() — '
                . 'set ffi.enable=true in php.ini (or, for PHP-FPM, php_admin_value[ffi.enable]=true '
                . 'in the pool config) and restart PHP-FPM / the process. '
                . 'See packages/php/README.md.',
            );
        }

        $path = self::findLibraryPath();
        if ($path === null) {
            throw new RuntimeException(
                'indycheck native library (' . self::libraryFileName() . ') not found. '
                . 'Build it from the indycheck repo root with: cargo build -p indycheck-ffi --release '
                . 'Then either set INDYCHECK_LIB_PATH to the built library, or place it in '
                . 'vendor/dusmamud/indycheck/lib/. See packages/php/README.md.',
            );
        }

        self::$ffi = FFI::cdef(self::CDEF, $path);

        return self::$ffi;
    }

    /**
     * Library file name for this platform.
     */
    private static function libraryFileName(): string
    {
        return match (PHP_OS_FAMILY) {
            'Windows' => 'indycheck_ffi.dll',
            'Darwin' => 'libindycheck_ffi.dylib',
            default => 'libindycheck_ffi.so',
        };
    }

    /**
     * Locate the native library. Resolution order:
     *   1. INDYCHECK_LIB_PATH environment variable
     *   2. vendor/dusmamud/indycheck/lib/<platform file> (Composer install)
     *   3. <package>/lib/<platform file> (vendored next to the package)
     *   4. <repo root>/target/release/<platform file> (cargo build)
     *   5. <repo root>/target/debug/<platform file>
     *   6. packages/target/release/<platform file> (repo checkout, src-relative)
     */
    private static function findLibraryPath(): ?string
    {
        $file = self::libraryFileName();
        $packageDir = dirname(__DIR__);
        $repoRoot = dirname(__DIR__, 3);

        $candidates = [];
        $env = getenv('INDYCHECK_LIB_PATH');
        if (is_string($env) && $env !== '') {
            $candidates[] = $env;
        }
        $candidates[] = $packageDir . '/vendor/dusmamud/indycheck/lib/' . $file;
        $candidates[] = $packageDir . '/lib/' . $file;
        $candidates[] = $repoRoot . '/target/release/' . $file;
        $candidates[] = $repoRoot . '/target/debug/' . $file;
        $candidates[] = __DIR__ . '/../../target/release/' . $file;

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
