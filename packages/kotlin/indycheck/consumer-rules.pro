# Consumer ProGuard / R8 rules for the indycheck AAR.
# The UniFFI-generated bindings load the native library through JNA
# (reflection-based), so keep those classes and don't warn on JNA internals.
-keep class uniffi.indycheck_uniffi.** { *; }
-keep class com.sun.jna.** { *; }
-dontwarn com.sun.jna.**
