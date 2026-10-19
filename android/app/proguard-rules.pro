# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in proguard-android.txt.

# react-native-reanimated & TurboModules
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Lunarr VLC Player & LibVLC native bindings (CRITICAL for release builds)
-keep class org.videolan.libvlc.** { *; }
-keep interface org.videolan.libvlc.** { *; }
-keepclassmembers class org.videolan.libvlc.** { *; }
-dontwarn org.videolan.libvlc.**

-keep class org.videolan.medialibrary.** { *; }
-keep interface org.videolan.medialibrary.** { *; }
-keepclassmembers class org.videolan.medialibrary.** { *; }
-dontwarn org.videolan.medialibrary.**

-keep class com.lunarr.vlcplayer.** { *; }
-keep interface com.lunarr.vlcplayer.** { *; }
-keepclassmembers class com.lunarr.vlcplayer.** { *; }
-dontwarn com.lunarr.vlcplayer.**

# Preserve all native methods across the app and libraries
-keepclasseswithmembernames class * {
    native <methods>;
}

# Preserve JNI callbacks
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}
-keep @androidx.annotation.Keep class * { *; }

# App custom native modules
-keep class com.anonymous.Stitchnexplay.** { *; }
-dontwarn com.anonymous.Stitchnexplay.**
