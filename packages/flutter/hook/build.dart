/// Build hook for the `indycheck` Dart package.
///
/// Downloads the prebuilt native library (`crates/indycheck-ffi`) for the
/// target platform from the indycheck GitHub release and registers it as
/// the code asset `package:indycheck/indycheck_ffi`, so the Dart code can
/// load it with `DynamicLibrary.codeAsset('package:indycheck/indycheck_ffi')`.
///
/// How it picks the archive:
/// * The package version is read from this package's `pubspec.yaml` at
///   runtime (never hardcoded), and the archive is
///   `indycheck-<version>-<platform>.tar.gz` (or `.zip` on Windows) from
///   `https://github.com/dusmamud/indycheck/releases/download/indycheck-v<version>/`.
/// * The platform comes from the build config (`CodeConfig.targetOS` /
///   `targetArchitecture`, plus `iOS.targetSdk` for device vs simulator).
///   Windows x64 uses the GNU archive only when `INDYCHECK_GNU=1` (or
///   the `gnu` user-define). Linux x64 musl is NOT downloadable: the
///   musl release archive is static-only (`libindycheck_ffi.a`, no
///   `.so`), which Dart cannot load, so selecting musl fails fast with
///   guidance instead of downloading an unusable archive.
/// * Downloads are cached under `.dart_tool/indycheck/<base-url-hash>/`
///   in the package, so a re-run does not re-download.
///
/// Verification: the hook fetches `SHA256SUMS.txt` from the same release
/// and checks the archive's SHA-256 against it. If that file is missing
/// or unreachable (older releases predate it), the hook says so in its
/// log output and falls back to checking that the extracted library
/// exists, is non-empty and has the expected file name.
///
/// Fallback: if the download fails (no release yet, 404, no network,
/// or a download that stalls — HTTP fetches time out after 120s for
/// the archive, 30s for SHA256SUMS.txt), the hook builds the library
/// from the Rust sources with `cargo build -p indycheck-ffi --release`
/// — but only when the target matches the host (same OS and
/// architecture) and the sources are present (a checkout of the
/// indycheck repo). Cargo is found on PATH first, then in the default
/// rustup location (`~/.cargo/bin`). For cross targets (Android, iOS,
/// ...) it fails with a clear error naming the archive URL and the
/// local build command instead of silently producing a
/// wrong-architecture library.
///
/// Configuration (user-defines win over environment variables — the
/// Dart/Flutter SDK runs hooks in a semi-hermetic environment and strips
/// most environment variables, so user-defines are the reliable channel
/// under `dart test` / `flutter build`; the environment variables work
/// when the hook is run directly):
///
/// ```yaml
/// # in the root package's pubspec.yaml
/// hooks:
///   user_defines:
///     indycheck:
///       release_base_url: /path/to/a/local/release/dir
///       native_lib: /path/to/libindycheck_ffi.so
///       musl: true
///       gnu: true
/// ```
///
/// * `release_base_url` / `INDYCHECK_RELEASE_BASE_URL` — override the
///   download base URL. Accepts an `https://` / `http://` URL, a
///   `file://` URL, or a plain directory path.
/// * `native_lib` / `INDYCHECK_NATIVE_LIB` — use this library file
///   directly, no download. (This is the same variable the Dart test
///   suite and `Indycheck.init()` read.)
/// * `musl` / `INDYCHECK_MUSL=1` — Linux x64: use the musl archive.
/// * `gnu` / `INDYCHECK_GNU=1` — Windows x64: use the GNU archive.
///
/// Web targets have no code config (`input.config.buildCodeAssets` is
/// false), so the hook emits no asset and succeeds without doing
/// anything.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:ffi' show Abi;
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:code_assets/code_assets.dart';
import 'package:crypto/crypto.dart';
import 'package:hooks/hooks.dart';

/// The asset id the Dart code loads:
/// `DynamicLibrary.codeAsset('package:indycheck/indycheck_ffi')`.
const _assetName = 'indycheck_ffi';

/// Base URL of the GitHub release downloads, with `<version>` filled in.
String _defaultBaseUrl(String version) =>
    'https://github.com/dusmamud/indycheck/releases/'
    'download/indycheck-v$version/';

/// One downloadable prebuilt archive: which release file to fetch for a
/// target, and which library file to take out of it.
final class _TargetSpec {
  const _TargetSpec({
    required this.platform,
    required this.libraryFileName,
    required this.isZip,
  });

  /// The `<platform>` part of `indycheck-<version>-<platform>.tar.gz`.
  final String platform;

  /// The library file inside the archive, e.g. `libindycheck_ffi.so`.
  final String libraryFileName;

  /// True for the Windows `.zip` archives, false for `.tar.gz`.
  final bool isZip;

  String archiveFileName(String version) =>
      'indycheck-$version-$platform.${isZip ? 'zip' : 'tar.gz'}';

  /// Archive download URL for [version] under [baseUrl].
  String archiveUrl(String baseUrl, String version) =>
      '$baseUrl${archiveFileName(version)}';

  /// Rust target triple that produces this archive (used in the
  /// fallback error message so the user can build it by hand).
  String get rustTarget => switch (platform) {
    'linux-x64-gnu' => 'x86_64-unknown-linux-gnu',
    'linux-x64-musl' => 'x86_64-unknown-linux-musl',
    'darwin-arm64' => 'aarch64-apple-darwin',
    'darwin-x64' => 'x86_64-apple-darwin',
    'win32-x64-msvc' => 'x86_64-pc-windows-msvc',
    'win32-x64-gnu' => 'x86_64-pc-windows-gnu',
    'android-arm64-v8a' => 'aarch64-linux-android',
    'android-armeabi-v7a' => 'armv7-linux-androideabi',
    'android-x86' => 'i686-linux-android',
    'android-x86_64' => 'x86_64-linux-android',
    'ios-arm64' => 'aarch64-apple-ios',
    'ios-simulator' => 'aarch64-apple-ios-sim',
    _ => '',
  };
}

/// Maps the build config to the release archive for that target.
///
/// Returns `null` when no prebuilt archive exists for the target (e.g.
/// Linux arm64, Windows arm64) — the caller then tries the source
/// fallback for host targets, or fails with a clear error.
_TargetSpec? _resolveTarget(BuildInput input, _HookConfig config) {
  final os = input.config.code.targetOS;
  final arch = input.config.code.targetArchitecture;
  if (os == OS.linux) {
    if (arch == Architecture.x64) {
      if (config.musl) {
        // The linux-x64-musl release archive is static-only: it
        // contains libindycheck_ffi.a and no .so (cargo drops cdylib
        // for the musl target), and Dart cannot load a static archive.
        // Fail fast with guidance instead of downloading an archive
        // the hook cannot use.
        throw UnsupportedError(
          'indycheck hook: the linux-x64-musl release archive is '
          'static-only (libindycheck_ffi.a, no libindycheck_ffi.so), '
          'and Dart cannot load a static archive, so the hook cannot '
          'provide a native library for musl from the release.\n'
          'Build a dynamically-linked musl library yourself, e.g. from '
          'the indycheck repo with:\n'
          '  RUSTFLAGS="-C target-feature=-crt-static" cargo build '
          '-p indycheck-ffi --release --target '
          'x86_64-unknown-linux-musl\n'
          'and point the hook at the built .so with the `native_lib` '
          'user-define or the INDYCHECK_NATIVE_LIB environment '
          'variable.',
        );
      }
      return const _TargetSpec(
        platform: 'linux-x64-gnu',
        libraryFileName: 'libindycheck_ffi.so',
        isZip: false,
      );
    }
    return null;
  }
  if (os == OS.macOS) {
    if (arch == Architecture.arm64) {
      return const _TargetSpec(
        platform: 'darwin-arm64',
        libraryFileName: 'libindycheck_ffi.dylib',
        isZip: false,
      );
    }
    if (arch == Architecture.x64) {
      return const _TargetSpec(
        platform: 'darwin-x64',
        libraryFileName: 'libindycheck_ffi.dylib',
        isZip: false,
      );
    }
    return null;
  }
  if (os == OS.windows) {
    if (arch == Architecture.x64) {
      return _TargetSpec(
        platform: config.gnu ? 'win32-x64-gnu' : 'win32-x64-msvc',
        libraryFileName: 'indycheck_ffi.dll',
        isZip: true,
      );
    }
    return null;
  }
  if (os == OS.android) {
    return switch (arch) {
      Architecture.arm64 => const _TargetSpec(
        platform: 'android-arm64-v8a',
        libraryFileName: 'libindycheck_ffi.so',
        isZip: false,
      ),
      Architecture.arm => const _TargetSpec(
        platform: 'android-armeabi-v7a',
        libraryFileName: 'libindycheck_ffi.so',
        isZip: false,
      ),
      // Android x86 is Architecture.ia32 in package:code_assets.
      Architecture.ia32 => const _TargetSpec(
        platform: 'android-x86',
        libraryFileName: 'libindycheck_ffi.so',
        isZip: false,
      ),
      Architecture.x64 => const _TargetSpec(
        platform: 'android-x86_64',
        libraryFileName: 'libindycheck_ffi.so',
        isZip: false,
      ),
      _ => null,
    };
  }
  if (os == OS.iOS) {
    // The simulator archive is arm64-only (a single libindycheck_ffi.a
    // for aarch64-apple-ios-sim; the x86_64 simulator slice is not
    // built — every Mac sold since 2020 runs the simulator as arm64).
    final simulator = input.config.code.iOS.targetSdk == IOSSdk.iPhoneSimulator;
    return _TargetSpec(
      platform: simulator ? 'ios-simulator' : 'ios-arm64',
      libraryFileName: 'libindycheck_ffi.a',
      isZip: false,
    );
  }
  return null;
}

/// Hook configuration: user-defines (from the root package's
/// `pubspec.yaml`, `hooks.user_defines.indycheck.*`) win over the
/// environment variables of the same meaning. The environment variables
/// are stripped by the Dart/Flutter SDK when it runs hooks
/// (semi-hermetic environment), so they only take effect when the hook
/// is run directly — the user-defines are the reliable channel.
final class _HookConfig {
  _HookConfig(BuildInput input)
    : releaseBaseUrlOverride = _stringOption(
        input,
        'release_base_url',
        'INDYCHECK_RELEASE_BASE_URL',
      ),
      nativeLib = _stringOption(input, 'native_lib', 'INDYCHECK_NATIVE_LIB'),
      musl = _boolOption(input, 'musl', 'INDYCHECK_MUSL'),
      gnu = _boolOption(input, 'gnu', 'INDYCHECK_GNU');

  final String? releaseBaseUrlOverride;
  final String? nativeLib;
  final bool musl;
  final bool gnu;

  static String? _stringOption(BuildInput input, String key, String envName) {
    final fromDefine = input.userDefines[key];
    if (fromDefine is String && fromDefine.isNotEmpty) return fromDefine;
    final fromEnv = Platform.environment[envName];
    if (fromEnv != null && fromEnv.isNotEmpty) return fromEnv;
    return null;
  }

  static bool _boolOption(BuildInput input, String key, String envName) {
    final fromDefine = input.userDefines[key];
    if (fromDefine is bool) return fromDefine;
    if (fromDefine is String) return _parseBool(fromDefine);
    final fromEnv = Platform.environment[envName];
    if (fromEnv == null) return false;
    return _parseBool(fromEnv);
  }

  static bool _parseBool(String value) {
    final v = value.trim().toLowerCase();
    return v == '1' || v == 'true' || v == 'yes';
  }
}

void main(List<String> args) async {
  await build(args, (input, output) async {
    // Web (and any other target without code assets) has no CodeConfig:
    // emit no asset and do not fail.
    if (!input.config.buildCodeAssets) {
      print('indycheck hook: no code assets for this target, skipping.');
      return;
    }

    final version = _readPackageVersion(input);
    final pubspecUri = input.packageRoot.resolve('pubspec.yaml');
    output.dependencies.add(pubspecUri);
    final config = _HookConfig(input);
    final baseUrl = config.releaseBaseUrlOverride != null
        ? _ensureTrailingSlash(config.releaseBaseUrlOverride!)
        : _defaultBaseUrl(version);

    // Escape hatch: use a given library file directly, no download.
    if (config.nativeLib != null) {
      final libFile = File(config.nativeLib!);
      if (!libFile.existsSync()) {
        throw StateError(
          'indycheck hook: INDYCHECK_NATIVE_LIB / native_lib points at a '
          'missing file: ${config.nativeLib}\n'
          'Build it first with `cargo build -p indycheck-ffi --release` '
          'from the indycheck repo, or unset the override to let the hook '
          'download the prebuilt library.',
        );
      }
      print(
        'indycheck hook: using native library directly from '
        '${libFile.path} (INDYCHECK_NATIVE_LIB / native_lib override, '
        'no download).',
      );
      output.dependencies.add(libFile.absolute.uri);
      _registerAsset(input, output, libFile.absolute.uri);
      return;
    }

    final target = _resolveTarget(input, config);
    if (target == null) {
      _failNoArchive(input, version, baseUrl);
    }

    final libFile = await _obtainLibrary(
      input,
      output,
      target,
      version,
      baseUrl,
    );
    _registerAsset(input, output, libFile.uri);
  });
}

void _registerAsset(BuildInput input, BuildOutputBuilder output, Uri libFile) {
  output.assets.code.add(
    CodeAsset(
      package: input.packageName,
      name: _assetName,
      linkMode: DynamicLoadingBundled(),
      file: libFile,
    ),
  );
  print(
    'indycheck hook: registered code asset '
    'package:${input.packageName}/$_assetName from $libFile',
  );
}

/// Reads the `version:` line from this package's `pubspec.yaml`.
/// The hook must never hardcode the version: the 0.2.3 merge (or any
/// later bump) changes what it downloads without a hook change.
String _readPackageVersion(BuildInput input) {
  final pubspec = File.fromUri(input.packageRoot.resolve('pubspec.yaml'));
  if (!pubspec.existsSync()) {
    throw StateError(
      'indycheck hook: pubspec.yaml not found at ${pubspec.path}.',
    );
  }
  final match = RegExp(
    r'^version:\s*(\S+)',
    multiLine: true,
  ).firstMatch(pubspec.readAsStringSync());
  if (match == null) {
    throw StateError(
      'indycheck hook: no `version:` line found in ${pubspec.path}.',
    );
  }
  // The value may be quoted in YAML; strip surrounding quotes.
  var raw = match.group(1)!.trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.substring(1, raw.length - 1);
  }
  if (!RegExp(r'^[0-9]+\.[0-9]+\.[0-9]+').hasMatch(raw)) {
    throw StateError(
      'indycheck hook: `version:` in ${pubspec.path} is not a '
      'version number: $raw.',
    );
  }
  return raw;
}

String _ensureTrailingSlash(String value) =>
    value.endsWith('/') ? value : '$value/';

/// Downloads (or reuses from cache) and extracts the release archive,
/// verifies it, and returns the extracted library file. Falls back to a
/// local Cargo build when the download fails and the target is the host.
Future<File> _obtainLibrary(
  BuildInput input,
  BuildOutputBuilder output,
  _TargetSpec target,
  String version,
  String baseUrl,
) async {
  final cacheDir = Directory.fromUri(
    // Keyed by the base URL, so different release sources (a fake
    // local release, the real GitHub release, ...) never share a
    // cached archive.
    input.packageRoot.resolve(
      '.dart_tool/indycheck/${sha256.convert(utf8.encode(baseUrl)).toString().substring(0, 12)}/',
    ),
  );
  cacheDir.createSync(recursive: true);
  final archiveName = target.archiveFileName(version);
  final cachedArchive = File('${cacheDir.path}$archiveName');

  List<int>? archiveBytes;
  var fromCache = false;
  if (cachedArchive.existsSync() && cachedArchive.lengthSync() > 0) {
    archiveBytes = cachedArchive.readAsBytesSync();
    fromCache = true;
    print('indycheck hook: reusing cached $archiveName.');
  } else {
    final archiveUrl = target.archiveUrl(baseUrl, version);
    print('indycheck hook: downloading $archiveUrl');
    try {
      archiveBytes = await _fetchBytes(baseUrl, archiveName);
    } on Object catch (e) {
      print('indycheck hook: download failed ($e), trying local build.');
      return _buildFromSource(input, output, target, version, baseUrl);
    }
    cachedArchive.writeAsBytesSync(archiveBytes);
    print(
      'indycheck hook: downloaded ${archiveBytes.length} bytes, '
      'cached at ${cachedArchive.path}.',
    );
  }
  output.dependencies.add(cachedArchive.uri);

  // Verify the SHA-256 against SHA256SUMS.txt from the same release.
  // Best effort: releases before 0.2.3 have no sums file, and a local
  // base URL may not have one either.
  final verified = await _verifyArchive(
    baseUrl,
    archiveName,
    archiveBytes,
    cachedArchive,
  );
  if (!verified) {
    // The cached copy failed verification: drop it and download once
    // more before giving up. A fresh download that still fails
    // verification is refused outright.
    if (fromCache) {
      print(
        'indycheck hook: cached $archiveName failed SHA-256 '
        'verification, re-downloading.',
      );
      cachedArchive.deleteSync();
      try {
        archiveBytes = await _fetchBytes(baseUrl, archiveName);
      } on Object catch (e) {
        print('indycheck hook: re-download failed ($e), trying local build.');
        return _buildFromSource(input, output, target, version, baseUrl);
      }
      cachedArchive.writeAsBytesSync(archiveBytes);
      if (!await _verifyArchive(
        baseUrl,
        archiveName,
        archiveBytes,
        cachedArchive,
      )) {
        throw StateError(
          'indycheck hook: SHA-256 verification failed for $archiveName '
          'even after re-download. Delete ${cachedArchive.path} and retry, '
          'or build locally with '
          '`cargo build -p indycheck-ffi --release`.',
        );
      }
    } else {
      throw StateError(
        'indycheck hook: SHA-256 verification failed for $archiveName '
        'downloaded from ${target.archiveUrl(baseUrl, version)}. '
        'Delete ${cachedArchive.path} and retry, or build locally with '
        '`cargo build -p indycheck-ffi --release`.',
      );
    }
  }

  final extractDir = Directory.fromUri(
    input.outputDirectoryShared.resolve(
      'indycheck-$version-${target.platform}/',
    ),
  );
  final libFile = _extractLibrary(archiveBytes, target, version, extractDir);
  _checkLibraryFile(libFile);
  return libFile;
}

/// Fetches `SHA256SUMS.txt` from [baseUrl] and checks [archiveBytes]
/// against the entry for [archiveName].
///
/// Returns `true` when the archive is verified, or when there is no
/// sums file / no entry for this archive (in which case it logs that
/// the SHA check was skipped and the caller falls back to the
/// existence/size checks on the extracted library).
Future<bool> _verifyArchive(
  String baseUrl,
  String archiveName,
  List<int> archiveBytes,
  File cachedArchive,
) async {
  Map<String, String>? sums;
  try {
    final sumsBytes = await _fetchBytes(
      baseUrl,
      'SHA256SUMS.txt',
      timeout: const Duration(seconds: 30),
    );
    sums = _parseSums(utf8.decode(sumsBytes));
  } on Object catch (e) {
    print(
      'indycheck hook: SHA256SUMS.txt not available from $baseUrl '
      '($e) — skipping SHA-256 verification and checking the '
      'extracted library exists, is non-empty and has the expected '
      'file name instead.',
    );
    return true;
  }
  final expected = sums[archiveName];
  if (expected == null) {
    print(
      'indycheck hook: SHA256SUMS.txt has no entry for $archiveName — '
      'skipping SHA-256 verification and checking the extracted '
      'library exists, is non-empty and has the expected file name '
      'instead.',
    );
    return true;
  }
  final actual = sha256.convert(archiveBytes).toString();
  if (actual == expected.toLowerCase()) {
    print('indycheck hook: SHA-256 verified for $archiveName.');
    return true;
  }
  print(
    'indycheck hook: SHA-256 mismatch for $archiveName '
    '(expected $expected, got $actual).',
  );
  return false;
}

/// Parses a `sha256sum` output file (`<hash>  <filename>` per line,
/// the filename possibly prefixed with `*` in binary mode).
Map<String, String> _parseSums(String text) {
  final sums = <String, String>{};
  for (final line in LineSplitter.split(text)) {
    final trimmed = line.trim();
    if (trimmed.isEmpty) continue;
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length < 2) continue;
    var name = parts.last;
    if (name.startsWith('*')) name = name.substring(1);
    sums[name] = parts.first.toLowerCase();
  }
  return sums;
}

/// Fetches [fileName] from [baseUrl], which may be an `http(s)://` URL,
/// a `file://` URL, or a plain directory path.
///
/// HTTP downloads time out after [timeout] (a stalled connection must
/// fail into the Cargo fallback, never hang the build forever — the
/// egress proxy has been seen to stall a GitHub download mid-response).
Future<List<int>> _fetchBytes(
  String baseUrl,
  String fileName, {
  Duration timeout = const Duration(seconds: 120),
}) async {
  final baseUri = _baseUri(baseUrl);
  final uri = baseUri.resolve(fileName);
  if (uri.isScheme('http') || uri.isScheme('https')) {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 30);
    try {
      return await _fetchHttp(client, uri).timeout(
        timeout,
        onTimeout: () => throw TimeoutException(
          'timed out after ${timeout.inSeconds}s fetching $uri',
        ),
      );
    } finally {
      client.close();
    }
  }
  final file = File.fromUri(uri);
  if (!file.existsSync()) {
    throw FileSystemException('file not found', file.path);
  }
  return file.readAsBytes();
}

Future<List<int>> _fetchHttp(HttpClient client, Uri uri) async {
  final request = await client.getUrl(uri);
  final response = await request.close();
  if (response.statusCode != HttpStatus.ok) {
    throw HttpException('HTTP ${response.statusCode} fetching $uri', uri: uri);
  }
  return await response.fold<List<int>>(
    <int>[],
    (bytes, chunk) => bytes..addAll(chunk),
  );
}

Uri _baseUri(String baseUrl) {
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return Uri.parse(baseUrl);
  }
  if (baseUrl.startsWith('file://')) {
    return Uri.parse(baseUrl);
  }
  return Directory(baseUrl).uri;
}

/// Extracts [archiveBytes] into [extractDir] and returns the library
/// file inside it.
File _extractLibrary(
  List<int> archiveBytes,
  _TargetSpec target,
  String version,
  Directory extractDir,
) {
  final Archive archive;
  try {
    archive = target.isZip
        ? ZipDecoder().decodeBytes(archiveBytes)
        : TarDecoder().decodeBytes(GZipDecoder().decodeBytes(archiveBytes));
  } on Object catch (e) {
    throw StateError(
      'indycheck hook: could not extract '
      '${target.archiveFileName(version)} ($e). The download may be '
      'corrupt — delete the cached archive under .dart_tool/indycheck/ '
      'and retry.',
    );
  }
  final written = <String>[];
  for (final entry in archive) {
    if (!entry.isFile) continue;
    // Never let a crafted archive write outside the extract dir.
    final segments = Uri.parse(entry.name).pathSegments;
    if (segments.isEmpty ||
        segments.any((s) => s == '..' || s.isEmpty) ||
        entry.name.startsWith('/')) {
      continue;
    }
    final outFile = File('${extractDir.path}${entry.name}');
    outFile.parent.createSync(recursive: true);
    outFile.writeAsBytesSync(entry.content);
    written.add(entry.name);
  }
  if (written.isEmpty) {
    throw StateError(
      'indycheck hook: ${target.archiveFileName(version)} contained no '
      'files.',
    );
  }
  // The archives contain a top-level `indycheck-<version>-<platform>/`
  // directory; fall back to a recursive search for the library name.
  final expected = File(
    '${extractDir.path}indycheck-$version-${target.platform}/'
    '${target.libraryFileName}',
  );
  if (expected.existsSync()) return expected;
  for (final entry in written) {
    if (entry.split('/').last == target.libraryFileName) {
      return File('${extractDir.path}$entry');
    }
  }
  throw StateError(
    'indycheck hook: ${target.archiveFileName(version)} does not contain '
    '${target.libraryFileName} (extracted: ${written.join(', ')}).',
  );
}

void _checkLibraryFile(File libFile) {
  if (!libFile.existsSync() || libFile.lengthSync() == 0) {
    throw StateError(
      'indycheck hook: extracted library ${libFile.path} is missing or '
      'empty.',
    );
  }
  print(
    'indycheck hook: extracted ${libFile.path} '
    '(${libFile.lengthSync()} bytes).',
  );
}

/// Builds the library from the Rust sources in the indycheck repo
/// checkout. Only for targets that match the host — cross targets fail
/// with a clear error naming the archive URL and the build command.
Future<File> _buildFromSource(
  BuildInput input,
  BuildOutputBuilder output,
  _TargetSpec target,
  String version,
  String baseUrl,
) async {
  final archiveUrl = target.archiveUrl(baseUrl, version);
  final repoRoot = Directory.fromUri(input.packageRoot.resolve('../../'));
  final ffiManifest = File('${repoRoot.path}crates/indycheck-ffi/Cargo.toml');
  if (!ffiManifest.existsSync()) {
    throw StateError(
      'indycheck hook: could not download $archiveUrl, and no Rust '
      'sources found at ${repoRoot.path} to build from (this happens '
      'when the package is installed from pub.dev, which ships no Rust '
      'code).\n'
      'Download the archive yourself from $archiveUrl and point the '
      'hook at it with the `native_lib` user-define or the '
      'INDYCHECK_NATIVE_LIB environment variable, or check out '
      'https://github.com/dusmamud/indycheck and build with '
      '`cargo build -p indycheck-ffi --release`.',
    );
  }
  if (!_targetIsHost(input)) {
    final triple = target.rustTarget;
    throw StateError(
      'indycheck hook: could not download $archiveUrl, and this target '
      '(${input.config.code.targetOS}/${input.config.code.targetArchitecture}) '
      'is not the host, so the hook cannot build it from source.\n'
      'Build it on the target machine (or with the right cross '
      'toolchain) with:\n'
      '  cargo build -p indycheck-ffi --release'
      '${triple.isNotEmpty ? ' --target $triple' : ''}\n'
      'then point the hook at the built library with the `native_lib` '
      'user-define or the INDYCHECK_NATIVE_LIB environment variable.',
    );
  }
  final cargo = await _findCargo();
  if (cargo == null) {
    throw StateError(
      'indycheck hook: could not download $archiveUrl, and `cargo` was '
      'not found on PATH or in the default rustup location '
      '(~/.cargo/bin), so the hook cannot build the library from '
      'source.\n'
      'Install the Rust toolchain (https://rustup.rs), or download the '
      'archive yourself from $archiveUrl and point the hook at it with '
      'the `native_lib` user-define or the INDYCHECK_NATIVE_LIB '
      'environment variable.',
    );
  }
  print(
    'indycheck hook: building from source with '
    '`$cargo build -p indycheck-ffi --release` in ${repoRoot.path}',
  );
  final result = await Process.run(cargo, [
    'build',
    '-p',
    'indycheck-ffi',
    '--release',
  ], workingDirectory: repoRoot.path);
  if (result.exitCode != 0) {
    throw StateError(
      'indycheck hook: `cargo build -p indycheck-ffi --release` failed '
      '(exit ${result.exitCode}) in ${repoRoot.path}.\n'
      'stdout: ${result.stdout}\n'
      'stderr: ${result.stderr}\n'
      'Alternatively download $archiveUrl and point the hook at it with '
      'the `native_lib` user-define or INDYCHECK_NATIVE_LIB.',
    );
  }
  final built = File(
    '${repoRoot.path}target/release/${target.libraryFileName}',
  );
  _checkLibraryFile(built);
  // Copy into the shared output dir so the registered asset does not
  // depend on the cargo target dir surviving.
  final outDir = Directory.fromUri(
    input.outputDirectoryShared.resolve(
      'indycheck-$version-${target.platform}-local/',
    ),
  );
  outDir.createSync(recursive: true);
  final copy = File('${outDir.path}${target.libraryFileName}');
  copy.writeAsBytesSync(built.readAsBytesSync());
  print('indycheck hook: built from source: ${copy.path}.');
  return copy;
}

/// True when the build target is the machine the hook runs on.
bool _targetIsHost(BuildInput input) {
  final targetOS = input.config.code.targetOS;
  final targetArch = input.config.code.targetArchitecture;
  if (targetOS != OS.current) return false;
  final hostArch = _hostArchitecture();
  return hostArch != null && targetArch == hostArch;
}

Architecture? _hostArchitecture() => switch (Abi.current()) {
  Abi.linuxX64 || Abi.macosX64 || Abi.windowsX64 => Architecture.x64,
  Abi.linuxArm64 || Abi.macosArm64 || Abi.windowsArm64 => Architecture.arm64,
  Abi.linuxIA32 || Abi.windowsIA32 => Architecture.ia32,
  Abi.linuxArm => Architecture.arm,
  _ => null,
};

/// Locates the cargo executable: `cargo` on PATH first, then the
/// default rustup location (`$HOME/.cargo/bin/cargo`,
/// `%USERPROFILE%\.cargo\bin\cargo.exe` on Windows). The SDK passes
/// PATH through to hooks, but a GUI-launched or bare shell may not
/// have cargo on PATH even though rustup installed it.
Future<String?> _findCargo() async {
  if (await _runsOk('cargo', ['--version'])) return 'cargo';
  final home =
      Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'];
  if (home != null && home.isNotEmpty) {
    final candidate = Platform.isWindows
        ? '$home\\.cargo\\bin\\cargo.exe'
        : '$home/.cargo/bin/cargo';
    if (await _runsOk(candidate, ['--version'])) return candidate;
  }
  return null;
}

Future<bool> _runsOk(String executable, List<String> args) async {
  try {
    final result = await Process.run(executable, args);
    return result.exitCode == 0;
  } on Object {
    return false;
  }
}

Never _failNoArchive(BuildInput input, String version, String baseUrl) {
  final os = input.config.code.targetOS;
  final arch = input.config.code.targetArchitecture;
  throw UnsupportedError(
    'indycheck hook: no prebuilt archive exists for $os/$arch, so the '
    'hook cannot download one (release base: $baseUrl, version '
    '$version).\n'
    'If this target is the host machine, build the library from the '
    'indycheck repo with `cargo build -p indycheck-ffi --release` and '
    'point the hook at it with the `native_lib` user-define or the '
    'INDYCHECK_NATIVE_LIB environment variable.',
  );
}
