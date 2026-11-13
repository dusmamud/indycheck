import 'package:flutter_test/flutter_test.dart';
import 'package:indycheck/indycheck.dart';
import 'package:indycheck_example/main.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  testWidgets('validates the prefilled test PAN', (tester) async {
    await tester.pumpWidget(const IndycheckExampleApp());

    await tester.tap(find.text('Validate PAN'));
    await tester.pump();

    expect(find.text('Valid'), findsOneWidget);
    expect(find.textContaining('code: VALID'), findsOneWidget);
  });

  testWidgets('rejects a PAN number as Aadhaar', (tester) async {
    await tester.pumpWidget(const IndycheckExampleApp());

    await tester.tap(find.text('Validate Aadhaar'));
    await tester.pump();

    expect(find.text('Invalid'), findsOneWidget);
  });

  testWidgets('validates a generated test Aadhaar number', (tester) async {
    await tester.pumpWidget(const IndycheckExampleApp());

    // Generated values are test data only — never real issued IDs.
    await tester.enterText(find.byType(TextField), Indycheck.generateAadhaar());
    await tester.tap(find.text('Validate Aadhaar'));
    await tester.pump();

    expect(find.text('Valid'), findsOneWidget);
    expect(find.textContaining('code: VALID'), findsOneWidget);
  });
}
