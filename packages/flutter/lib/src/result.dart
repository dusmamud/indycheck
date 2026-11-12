/// The single result type returned by every validator, matching the
/// Rust core's `ValidationResult` and its JSON shape.
///
/// A failed validation is a normal [ValidationResult] with [valid] set
/// to `false` and a stable [code] (`INVALID_FORMAT`, `INVALID_LENGTH`,
/// `EMPTY`, ...). `parsed` holds the extracted fields on success (for
/// example PAN `entity` / `entity_code`, or vehicle `series_type` /
/// `state_code` / `district` / `series` / `number`) and is `null`
/// otherwise — the JSON omits `parsed` when there is nothing to report.
class ValidationResult {
  const ValidationResult({
    required this.valid,
    required this.code,
    required this.reasonEn,
    required this.reasonHi,
    this.parsed,
  });

  factory ValidationResult.fromJson(Map<String, dynamic> json) {
    final parsed = json['parsed'];
    return ValidationResult(
      valid: json['valid'] as bool? ?? false,
      code: json['code'] as String? ?? '',
      reasonEn: json['reason_en'] as String? ?? '',
      reasonHi: json['reason_hi'] as String? ?? '',
      parsed: parsed == null
          ? null
          : Map<String, dynamic>.from(parsed as Map),
    );
  }

  /// Whether the input is well-formed (and its checksum, where one
  /// exists, is correct).
  final bool valid;

  /// Stable result code: `VALID` on success, otherwise a code such as
  /// `INVALID_FORMAT`, `INVALID_LENGTH`, `INVALID_CHECKSUM` or `EMPTY`.
  final String code;

  /// Human-readable reason in English.
  final String reasonEn;

  /// Human-readable reason in Roman-script Hinglish.
  final String reasonHi;

  /// Extracted fields on success, `null` otherwise.
  final Map<String, dynamic>? parsed;

  Map<String, dynamic> toJson() {
    return {
      'valid': valid,
      'code': code,
      'reason_en': reasonEn,
      'reason_hi': reasonHi,
      if (parsed != null) 'parsed': parsed,
    };
  }

  @override
  String toString() => 'ValidationResult(valid: $valid, code: $code)';
}
