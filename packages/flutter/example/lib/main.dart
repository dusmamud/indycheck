import 'package:indycheck/indycheck.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  runApp(const IndycheckExampleApp());
}

/// Example app for the `indycheck` package: type a PAN or Aadhaar number
/// and validate it offline.
///
/// The native library needs no setup here — the package's build hook
/// (`packages/flutter/hook/build.dart`) downloads the prebuilt
/// `libindycheck_ffi` for the target platform (or builds it from the Rust
/// sources) and bundles it automatically when the app is built or tested.
class IndycheckExampleApp extends StatelessWidget {
  const IndycheckExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'indycheck example',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
      ),
      home: const ValidatePage(),
    );
  }
}

class ValidatePage extends StatefulWidget {
  const ValidatePage({super.key});

  @override
  State<ValidatePage> createState() => _ValidatePageState();
}

class _ValidatePageState extends State<ValidatePage> {
  final TextEditingController _controller = TextEditingController(
    text: 'ABCDE1234F',
  );
  ValidationResult? _result;
  String _label = '';

  void _validate(bool aadhaar) {
    final input = _controller.text;
    setState(() {
      _label = aadhaar ? 'Aadhaar' : 'PAN';
      _result = aadhaar
          ? Indycheck.validateAadhaar(input)
          : Indycheck.validatePan(input);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Scaffold(
      appBar: AppBar(title: const Text('indycheck example')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Type a PAN or Aadhaar number and validate it offline. '
              'The prefilled value is test data, not a real issued ID.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              decoration: const InputDecoration(
                labelText: 'PAN or Aadhaar number',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _validate(false),
                    child: const Text('Validate PAN'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _validate(true),
                    child: const Text('Validate Aadhaar'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            if (result != null) ...[
              Text(
                result.valid ? 'Valid' : 'Invalid',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: result.valid ? Colors.green : Colors.red,
                ),
              ),
              const SizedBox(height: 8),
              Text('$_label  •  code: ${result.code}'),
              const SizedBox(height: 4),
              Text('Reason: ${result.reasonEn}'),
              Text('Reason (HI): ${result.reasonHi}'),
            ],
          ],
        ),
      ),
    );
  }
}
