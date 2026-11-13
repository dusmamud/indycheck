// indycheck Android library — UniFFI Kotlin bindings (JNA) over the Rust
// core, published to Maven Central as
// io.github.dusmamud:indycheck:<version> (see gradle.properties).
//
// The native .so files for the 4 Android ABIs are built from Rust with
// cargo-ndk by the `buildNativeLibs` task (scripts/build-native-libs.sh)
// and staged into src/main/jniLibs, so the AAR is self-contained: an app
// using this library does NOT need Rust installed.
//
// Publishing uses the vanniktech Maven Publish plugin (0.37.0) against the
// Sonatype Central Portal (OSSRH is retired — do not use it). The plugin
// auto-configures the sources + javadoc jars for an Android library.
// GPG signing is mandatory for Maven Central; the in-memory key and the
// Portal user token come from the environment (CI secrets):
//   ORG_GRADLE_PROJECT_mavenCentralUsername / mavenCentralPassword
//   ORG_GRADLE_PROJECT_signingInMemoryKey / signingInMemoryKeyPassword
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.vanniktech.maven.publish")
}

// Lockstep version, from gradle.properties (synced by
// scripts/sync-versions.sh from the root Cargo.toml).
val indycheckVersion: String by project

android {
    namespace = "io.github.dusmamud.indycheck"
    compileSdk = 34

    defaultConfig {
        minSdk = 21
        consumerProguardFiles("consumer-rules.pro")
    }

    // The generated UniFFI bindings live in the Rust crate (single source
    // of truth) — reference them here instead of copying the file. The
    // bindings are verified current by regenerating them from the UDL
    // (see crates/indycheck-uniffi/README.md); do not edit them by hand.
    sourceSets {
        getByName("main") {
            java.srcDirs(
                "src/main/java",
                "../../../crates/indycheck-uniffi/bindings/kotlin",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// The UniFFI-generated bindings load the native library through JNA.
// `api` (not `implementation`) so consumers get JNA transitively.
dependencies {
    api("net.java.dev.jna:jna:5.16.0")
}

// Build libindycheck_uniffi.so for the 4 Android ABIs with cargo-ndk and
// stage the .so files into src/main/jniLibs/<abi>/ before the AAR is built.
val buildNativeLibs by tasks.registering(Exec::class) {
    description = "Builds libindycheck_uniffi.so for armeabi-v7a, arm64-v8a, x86 and x86_64 with cargo-ndk and stages them into jniLibs."
    group = "build"
    workingDir = rootDir
    commandLine("bash", "scripts/build-native-libs.sh")
    inputs.dir(rootProject.file("../../crates/indycheck-uniffi"))
    inputs.file(rootProject.file("scripts/build-native-libs.sh"))
    outputs.dir(layout.projectDirectory.dir("src/main/jniLibs"))
}

tasks.named("preBuild") {
    dependsOn(buildNativeLibs)
}

mavenPublishing {
    // Central Portal only (SonatypeHost was removed in vanniktech 0.37.0;
    // OSSRH is retired). automaticRelease polls the deployment until it
    // reaches PUBLISHED (or FAILED, which fails the build).
    publishToMavenCentral(
        automaticRelease = true,
        validateDeployment = DeploymentValidation.PUBLISHED,
    )
    signAllPublications()
    coordinates("io.github.dusmamud", "indycheck", indycheckVersion)
    pom {
        name = "indycheck"
        description = "Offline format + checksum validation for Indian IDs (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN, TAN, CIN, LLPIN, Voter ID / EPIC, vehicle incl. Bharat BH) for Kotlin/Android."
        inceptionYear = "2026"
        url = "https://github.com/dusmamud/indycheck"
        licenses {
            license {
                name = "MIT License"
                url = "https://github.com/dusmamud/indycheck/blob/main/LICENSE"
                distribution = "https://github.com/dusmamud/indycheck/blob/main/LICENSE"
            }
        }
        developers {
            developer {
                id = "dusmamud"
                name = "dusmamud"
                url = "https://github.com/dusmamud"
            }
        }
        scm {
            url = "https://github.com/dusmamud/indycheck"
            connection = "scm:git:git://github.com/dusmamud/indycheck.git"
            developerConnection = "scm:git:ssh://git@github.com/dusmamud/indycheck.git"
        }
    }
}
