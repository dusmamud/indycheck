package indycheck

import "testing"

func TestValidatePan(t *testing.T) {
	r, err := ValidatePan("ABCDE1234F")
	if err != nil {
		t.Fatal(err)
	}
	if !r.Valid || r.Code != "VALID" {
		t.Fatalf("expected VALID, got %+v", r)
	}
	if r.Parsed["entity_code"] != "D" {
		t.Fatalf("expected entity_code D, got %v", r.Parsed["entity_code"])
	}
	if r.ReasonHI == "" {
		t.Fatal("expected a Hindi reason")
	}

	r, err = ValidatePan("ABCDE12345")
	if err != nil {
		t.Fatal(err)
	}
	if r.Valid || r.Code != "INVALID_FORMAT" {
		t.Fatalf("expected INVALID_FORMAT, got %+v", r)
	}
	if r.Parsed != nil {
		t.Fatalf("expected no parsed fields on failure, got %v", r.Parsed)
	}
}

func TestValidateAadhaarGstinMobilePincode(t *testing.T) {
	cases := []struct {
		name string
		fn   func(string) (Result, error)
		in   string
	}{
		{"aadhaar", ValidateAadhaar, "234567890124"},
		{"gstin", ValidateGstin, "18AAAPL1234C1ZD"},
		{"mobile", ValidateMobile, "9876543210"},
		{"mobile +91", ValidateMobile, "+91 98765 43210"},
		{"pincode", ValidatePincode, "781001"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r, err := c.fn(c.in)
			if err != nil {
				t.Fatal(err)
			}
			if !r.Valid || r.Code != "VALID" {
				t.Fatalf("expected VALID for %q, got %+v", c.in, r)
			}
		})
	}
}

func TestValidateVehicleStateAndBharat(t *testing.T) {
	r, err := ValidateVehicle("DL01AB1234")
	if err != nil {
		t.Fatal(err)
	}
	if !r.Valid || r.Parsed["series_type"] != "state" {
		t.Fatalf("expected state VALID, got %+v", r)
	}
	if r.Parsed["state_code"] != "DL" || r.Parsed["number"] != "1234" {
		t.Fatalf("unexpected parsed fields: %v", r.Parsed)
	}

	// Bharat (BH) series: YYBH####XX, year 21+.
	r, err = ValidateVehicle("22BH1234AA")
	if err != nil {
		t.Fatal(err)
	}
	if !r.Valid || r.Code != "VALID" {
		t.Fatalf("expected BH VALID, got %+v", r)
	}
	if r.Parsed["series_type"] != "bharat" || r.Parsed["year"] != "22" ||
		r.Parsed["suffix"] != "AA" {
		t.Fatalf("unexpected BH parsed fields: %v", r.Parsed)
	}

	// BH year before 2021 must fail.
	r, err = ValidateVehicle("20BH1234AA")
	if err != nil {
		t.Fatal(err)
	}
	if r.Valid {
		t.Fatalf("expected 20BH1234AA to fail, got %+v", r)
	}
}

func TestValidateIfscUpi(t *testing.T) {
	r, err := ValidateIfsc("SBIN0000123")
	if err != nil {
		t.Fatal(err)
	}
	if !r.Valid || r.Parsed["bank_code"] != "SBIN" {
		t.Fatalf("expected IFSC VALID, got %+v", r)
	}

	r, err = ValidateUpi("dus@okaxis")
	if err != nil {
		t.Fatal(err)
	}
	if !r.Valid || r.Parsed["handle"] != "okaxis" {
		t.Fatalf("expected UPI VALID, got %+v", r)
	}
}

func TestDetect(t *testing.T) {
	cases := map[string]string{
		"ABCDE1234F": "pan",
		"9876543210": "mobile",
		"22BH1234AA": "vehicle",
		"not an id":  "unknown",
	}
	for in, want := range cases {
		got, err := Detect(in)
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("Detect(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestValidateMany(t *testing.T) {
	results, err := ValidateMany([]string{"ABCDE1234F", "9876543210", "nope"})
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	if !results[0].Valid || !results[1].Valid || results[2].Valid {
		t.Fatalf("unexpected batch results: %+v", results)
	}
}

func TestVersion(t *testing.T) {
	v, err := Version()
	if err != nil {
		t.Fatal(err)
	}
	if v == "" {
		t.Fatal("expected a non-empty version")
	}
	t.Logf("indycheck version: %s", v)
}
