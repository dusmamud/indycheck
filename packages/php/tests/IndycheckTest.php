<?php

declare(strict_types=1);

namespace Indycheck\Tests;

use Indycheck\Indycheck;
use PHPUnit\Framework\TestCase;

/**
 * Tests for the PHP FFI binding. They exercise the real native library
 * (built with `cargo build -p indycheck-ffi --release`), which the
 * Indycheck class locates the same way in production — in CI the path
 * is handed in through the INDYCHECK_LIB_PATH environment variable.
 * No network is used, and nothing here is random except the
 * generators, whose output is always validated again.
 */
final class IndycheckTest extends TestCase
{
    public function testValidatePanValid(): void
    {
        $result = Indycheck::validatePan('ABCDE1234F');

        $this->assertTrue($result['valid']);
        $this->assertSame('VALID', $result['code']);
        $this->assertArrayHasKey('reason_en', $result);
        $this->assertArrayHasKey('reason_hi', $result);
        $this->assertArrayHasKey('parsed', $result);
    }

    public function testValidatePanInvalid(): void
    {
        $result = Indycheck::validatePan('ABCDE12345');

        $this->assertFalse($result['valid']);
        $this->assertNotSame('VALID', $result['code']);
        $this->assertArrayHasKey('reason_en', $result);
        $this->assertArrayHasKey('reason_hi', $result);
    }

    public function testValidateAadhaarValid(): void
    {
        $result = Indycheck::validateAadhaar('234567890124');

        $this->assertTrue($result['valid']);
        $this->assertSame('VALID', $result['code']);
    }

    public function testValidateMobileValid(): void
    {
        $result = Indycheck::validateMobile('9876543210');

        $this->assertTrue($result['valid']);
        $this->assertSame('VALID', $result['code']);
    }

    public function testValidateGstinValid(): void
    {
        $result = Indycheck::validateGstin('27AAAPL1234C1ZE');

        $this->assertTrue($result['valid']);
        $this->assertSame('VALID', $result['code']);
    }

    public function testValidateVehicleStateFormat(): void
    {
        $result = Indycheck::validateVehicle('DL01AB1234');

        $this->assertTrue($result['valid']);
        $this->assertSame('VALID', $result['code']);
    }

    public function testValidateVehicleBharatSeries(): void
    {
        $result = Indycheck::validateVehicle('22BH1234AA');

        $this->assertTrue($result['valid']);
        $this->assertSame('VALID', $result['code']);
        $this->assertArrayHasKey('parsed', $result);
        $this->assertSame('bharat', $result['parsed']['series_type']);
    }

    public function testDetectPan(): void
    {
        $this->assertSame('pan', Indycheck::detect('ABCDE1234F'));
    }

    public function testValidateManyPreservesOrder(): void
    {
        $results = Indycheck::validateMany(['ABCDE1234F', '9876543210', 'not-an-id']);

        $this->assertCount(3, $results);
        $this->assertTrue($results[0]['valid']);
        $this->assertTrue($results[1]['valid']);
        $this->assertFalse($results[2]['valid']);
    }

    public function testGeneratePanValidates(): void
    {
        $pan = Indycheck::generatePan();

        $this->assertSame(10, strlen($pan));
        $this->assertTrue(Indycheck::validatePan($pan)['valid']);
    }

    public function testGenerateVehicleBharatContainsBhAndValidates(): void
    {
        $vehicle = Indycheck::generateVehicleBharat();

        $this->assertStringContainsString('BH', $vehicle);
        $result = Indycheck::validateVehicle($vehicle);
        $this->assertTrue($result['valid']);
        $this->assertSame('bharat', $result['parsed']['series_type']);
    }

    public function testGenerateAadhaarValidates(): void
    {
        $aadhaar = Indycheck::generateAadhaar();

        $this->assertSame(12, strlen($aadhaar));
        $this->assertTrue(Indycheck::validateAadhaar($aadhaar)['valid']);
    }

    public function testGenerateGstinValidates(): void
    {
        $gstin = Indycheck::generateGstin();

        $this->assertSame(15, strlen($gstin));
        $this->assertTrue(Indycheck::validateGstin($gstin)['valid']);
    }

    public function testGenerateMobileValidates(): void
    {
        $mobile = Indycheck::generateMobile();

        $this->assertSame(10, strlen($mobile));
        $this->assertTrue(Indycheck::validateMobile($mobile)['valid']);
    }

    public function testGenerateVehicleValidates(): void
    {
        $vehicle = Indycheck::generateVehicle();

        $this->assertTrue(Indycheck::validateVehicle($vehicle)['valid']);
    }

    public function testVersion(): void
    {
        $this->assertSame('0.2.3', Indycheck::version());
    }
}
