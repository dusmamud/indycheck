<?php

declare(strict_types=1);

/**
 * Setup check for the indycheck PHP package.
 *
 * Usage: php scripts/setup.php
 *
 * Verifies the PHP version, ext-ffi / ext-json, the ffi.enable ini
 * setting, and that the native library can be found. Exit code 0 when
 * everything is OK, 1 otherwise. Run it with the same PHP binary and
 * ini that will run the package — CLI and PHP-FPM can have different
 * php.ini files.
 */

$ok = true;

function check(bool $passed, string $label, string $detail = ''): void
{
    global $ok;

    if (!$passed) {
        $ok = false;
    }

    echo ($passed ? 'OK   ' : 'FAIL ') . $label;
    if ($detail !== '') {
        echo ' — ' . $detail;
    }
    echo PHP_EOL;
}

// 1. PHP version.
check(
    PHP_VERSION_ID >= 80100,
    'PHP >= 8.1',
    'running ' . PHP_VERSION,
);

// 2. ext-ffi.
check(
    extension_loaded('ffi') && class_exists(FFI::class),
    'ext-ffi loaded',
    extension_loaded('ffi') ? '' : 'the FFI extension is not loaded',
);

// 3. ffi.enable — must be 'true' ('1' as read back by ini_get()).
//    It is a PHP_INI_SYSTEM setting: it cannot be changed with
//    ini_set(), and the PHP default ('preload') only allows FFI inside
//    preload scripts, which is not how this package runs.
$ffiEnable = ini_get('ffi.enable');
if ($ffiEnable === '1' || $ffiEnable === 'true') {
    check(true, 'ffi.enable=true', "currently '{$ffiEnable}'");
} else {
    check(false, 'ffi.enable=true', "currently '{$ffiEnable}'");
    echo '     ffi.enable is a PHP_INI_SYSTEM setting — ini_set() cannot change it.' . PHP_EOL;
    echo '     CLI: add ffi.enable=true to php.ini, or run with: php -d ffi.enable=true ...' . PHP_EOL;
    echo '     PHP-FPM: add php_admin_value[ffi.enable]=true to the pool config,' . PHP_EOL;
    echo '              then restart PHP-FPM. (php.ini ffi.enable=true works too.)' . PHP_EOL;
}

// 4. ext-json.
check(
    extension_loaded('json'),
    'ext-json loaded',
    extension_loaded('json') ? '' : 'the JSON extension is not loaded',
);

// 5. Native library. Same resolution order as Indycheck::findLibraryPath():
//    INDYCHECK_LIB_PATH, then vendor/dusmamud/indycheck/lib/, then the
//    cargo build output under the repo root.
$libFile = match (PHP_OS_FAMILY) {
    'Windows' => 'indycheck_ffi.dll',
    'Darwin' => 'libindycheck_ffi.dylib',
    default => 'libindycheck_ffi.so',
};
$packageDir = dirname(__DIR__);
$repoRoot = dirname(__DIR__, 3);

$candidates = [];
$env = getenv('INDYCHECK_LIB_PATH');
if (is_string($env) && $env !== '') {
    $candidates[] = $env;
}
$candidates[] = $packageDir . '/vendor/dusmamud/indycheck/lib/' . $libFile;
$candidates[] = $packageDir . '/lib/' . $libFile;
$candidates[] = $repoRoot . '/target/release/' . $libFile;
$candidates[] = $repoRoot . '/target/debug/' . $libFile;
$candidates[] = __DIR__ . '/../../target/release/' . $libFile;

$found = null;
foreach ($candidates as $candidate) {
    if (is_file($candidate)) {
        $found = $candidate;
        break;
    }
}

if ($found !== null) {
    check(true, 'native library FOUND', $found);
} else {
    check(false, 'native library FOUND', 'looked for ' . $libFile);
    echo '     Build it from the indycheck repo root with:' . PHP_EOL;
    echo '       cargo build -p indycheck-ffi --release' . PHP_EOL;
    echo '     Then set INDYCHECK_LIB_PATH to the built library, or place it in' . PHP_EOL;
    echo '     vendor/dusmamud/indycheck/lib/ .' . PHP_EOL;
}

echo $ok ? 'All checks passed.' . PHP_EOL : 'Setup is incomplete — fix the FAIL lines above.' . PHP_EOL;
exit($ok ? 0 : 1);
