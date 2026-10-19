# ProGuard rules for @lunarr/vlc-player and LibVLC
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

-keepclasseswithmembernames class * {
    native <methods>;
}
