# 🎬 NexPlay — High-Performance Cinematic Streaming Hub

<div align="center">

![NexPlay Logo](assets/icon.png)

**A modern, ad-free streaming and media entertainment application for Android mobile and Android TV devices.**  
*Powered by Native React Native, Expo SDK 57, and Hardware-Accelerated LibVLC.*

---

[![Android](https://img.shields.io/badge/Platform-Android%208.0%2B%20(API%2026--36)-3DDC84?logo=android&logoColor=white)](https://developer.android.com)
[![React Native](https://img.shields.io/badge/React%20Native-0.86.2-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-v57.0.14-000020?logo=expo&logoColor=white)](https://expo.dev)
[![LibVLC](https://img.shields.io/badge/Player-LibVLC%20Native-FF8800?logo=vlc-media-player&logoColor=white)](https://www.videolan.org/vlc/libvlc.html)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 🌟 Key Highlights & Special Features

NexPlay is engineered from the ground up to deliver a seamless, premium streaming experience with zero intrusive advertisements, instant playback resolution, multi-language audio switching, and intelligent metadata matching.

### 1. ⚡ Multi-Server Scraping Architecture
NexPlay utilizes a multi-provider scraping and stream extraction pipeline designed to deliver high availability and link redundancy:

| Server | Provider | Specialization & Content Focus | Supported Audio & Qualities |
| :--- | :--- | :--- | :--- |
| **Server 1** | **HDHub4u** | Indian Regional Cinema (Hindi, Tamil, Telugu, Malayalam, Kannada), Bollywood, South Dubbed | Multi-Audio, Dual Audio, WEB-DL, Bluray (480p to 1080p) |
| **Server 2** | **4KHDHub** | Hollywood Blockbusters, 4K UHD Releases, TV Series Packs, K-Dramas | 4K UHD, 1080p FHD, 720p, 5.1 Surround, Dolby Atmos |
| **Server 3** | **Movies4u** | Ultra-Fast Cloud & Direct Streams (PixelDrain, FSL, StreamTape, FastDL) | Multi-Audio, Dual Audio, High-Speed CDN Links |
| **Server 6** | **TamilDhool** | Daily Regional Broadcast Serials (Sun TV, Vijay TV, Zee Tamil, Colors) | Live Daily Epistolic Streams, SD/HD |
| **Server 7** | **TamilGun** | Archival & Regional Tamil/South Indian Movies | Classical & Current South Indian Streams |

- **Automatic Cross-Provider Fallback**: If Server 1 encounters a network timeout or missing post, NexPlay transparently cascades through Server 2 and Server 3 without interrupting the user.
- **Dynamic Live Domain Resolution**: Automatically queries live mirrors and updates dormant domains on the fly to bypass carrier blocking.

---

### 2. 🎯 Intelligent Release Year Disambiguation
Movies frequently share identical titles across different decades or releases (e.g., ***Moana (2026)*** vs ***Moana (2016)***, ***Pinocchio (2022)*** vs ***Pinocchio (1940)***, or ***Avatar (2009)*** vs ***Avatar: The Way of Water (2022)***).

- **Exact Release Year Verification**: Target release years passed from TMDB are matched against server post metadata and URLs with a 50% score boost for exact matches.
- **Strict Disqualification of Conflicting Years**: A discrepancy of 3+ years incurs a severe 95% penalty (`yearMultiplier = 0.05`), ensuring older or newer remakes are never accidentally served.
- **Sequel & Franchise Number Preservation**: Regex token filters distinguish between 4-digit release years (`1900–2099`) and sequel digits (e.g., *Moana 2*, *Avatar 2*, *Deadpool 2*), preserving franchise integrity.

---

### 3. 📺 Universal Video Quality Engine (720p • 1080p • 4K)
NexPlay empowers users to choose their preferred streaming resolution from the **Settings / Account** screen:

- **Quality Preferences**:
  - **4K UHD (2160p)**: Maximum bitrate and clarity for large screens and Android TV.
  - **1080p FHD**: Optimal balance between visual fidelity and bandwidth efficiency.
  - **720p HD**: High-speed, data-saver streaming for mobile data or slower connections.
- **Graceful Auto-Fallback**: If a user selects 4K but a movie is only available in 1080p, the engine seamlessly selects the highest available resolution (1080p) and badges the UI with the genuine quality level.
- **Persistent Storage**: Preferences are saved persistently via `AppSettings` and applied automatically across all movies and series episodes.

---

### 4. 🎧 Multi-Language Audio & Subtitle Track Switching (LibVLC)
Powered by the native hardware-accelerated **LibVLC** player engine (`@lunarr/vlc-player`):

- **In-Stream Audio Switching**: Effortlessly toggle between Hindi, Tamil, Telugu, English, Malayalam, Kannada, Korean, Japanese, and original soundtracks during live playback.
- **Surround Sound Support**: Full pass-through and decoding for Dolby Atmos, Dolby Digital Plus (E-AC-3), DTS, and AAC 5.1/7.1 audio tracks.
- **Subtitle Track Selector**: Switch between embedded soft-subtitles (SRT, VTT, ASS) with instant synchronization and styling.
- **Aspect Ratio & Fit Controls**: Toggle between Default, 16:9, 4:3, Fill Screen, and Original scaling.

---

### 5. ⏭️ TIDB Intro, Recap & Credits Automation
NexPlay integrates with **The Intro DB (TIDB)** community database to enhance binge-watching:

- **One-Click "Skip Intro"**: When intro timestamps are detected, a clean overlay button appears for instant skipping.
- **Recap & Outro Skipping**: Automatically jumps past recaps at the start of episodes and rolls directly into the next episode during credits.

---

### 6. 🛡️ Private DNS-over-HTTPS (DoH) Carrier Bypass
To overcome ISP domain poisoning and regional DNS blocks without requiring external VPN software:

- Integrated multi-provider DoH resolver supporting:
  - **Cloudflare DNS** (`1.1.1.1 / https://cloudflare-dns.com/dns-query`)
  - **Google Public DNS** (`8.8.8.8 / https://dns.google/resolve`)
  - **AdGuard DNS** (`https://dns.adguard.com/dns-query`)
- Secure SNI request headers allow direct connection to streaming endpoints even on restrictive cellular networks.

---

### 7. ⏱️ Continue Watching with Background Progress & Posters
- **Exact Position Resume**: Tracks playback progress, completed percentage, duration, and last-watched timestamps locally.
- **Automatic Resume Prompt**: One-tap resume from where you left off or restart from the beginning.
- **Reliable Poster Resolution**: Automatically resolves relative TMDB image paths into full high-resolution URLs (`w500` posters, `w1280` backdrops), ensuring thumbnail images never fail to render.

---

### 8. 🔄 Smart TV Series "Up Next" & Finale Handling
- **Context-Aware Progression**: Automatically suggests the next episode within the current season (e.g., S5 E7 -> S5 E8) or progresses to the next season premiere (e.g., S4 E10 -> S5 E1).
- **Finale Safety**: When finishing the final episode of a series, the app avoids generating fake synthetic episodes and instead displays curated TMDB recommendations (e.g., *Breaking Bad* finale recommends *Better Call Saul*).

---

### 9. 🔍 Real-Time Popular Searches & TMDB Discovery
- Dynamic popular search tags fetched live from TMDB's trending movie and series endpoints.
- Instant genre filtering (Action, Sci-Fi, Thriller, Animation, Drama) with debounced search input.

---

## 🏛️ Component Architecture

```
Stitch-nexplay/
├── App.js                         # Root Application Controller & Global State
├── app.json                       # Expo Application Manifest & Android Configuration
├── build_app.ps1                  # Multi-Architecture Gradle Build & Release Script
│
├── src/
│   ├── components/
│   │   ├── AccountScreen.js       # User Preferences, Quality Selector (720p/1080p/4K), DNS Settings
│   │   ├── AppHeader.js           # Minimalist Header with vector iconography & brand identity
│   │   ├── CategoryDetailScreen.js# Genre & Category Infinite-Scroll Browsing Grid
│   │   ├── ContinueWatchingRow.js # Horizontal carousel for in-progress playback resume
│   │   ├── MovieDetailScreen.js   # Media Showcase, Embedded LibVLC Player, Server/Quality Switcher
│   │   ├── MoviesScreen.js        # Featured & Top Rated Movies Catalog
│   │   ├── SearchScreen.js        # Dynamic TMDB Trending Queries & Real-Time Search Engine
│   │   └── TvSeriesScreen.js      # TV Shows Hub with Season/Episode Pickers
│   │
│   └── utils/
│       ├── AppSettings.js         # Persistent Quality & System Settings Store
│       ├── DnsResolver.js         # Cloudflare / Google / AdGuard DoH Engine
│       ├── ExtensionManager.js    # Multi-Provider Search Aggregator & Stream Coordinator
│       ├── Movies4uProvider.js    # Server 3 Direct Link & Search Extractor
│       ├── PlaybackProgressManager.js # Continue Watching State & Image Path Normalization
│       ├── ProviderUpdateManager.js # GitHub OTA Scraper Updates Pipeline
│       └── ScraperEngine.js       # Core Provider Scrapers (HDHub4u, 4KHDHub, Token Bridge Decoders)
│
└── android/                       # Native Android Project & Gradle Configuration
```

---

## 📱 Multi-Architecture Binary Releases (APKs)

NexPlay compiles into three dedicated Android APK architectures to ensure peak performance across all hardware tiers:

| Architecture | Target ABI | Recommended Devices | APK File Name |
| :--- | :--- | :--- | :--- |
| **64-bit APK** | `arm64-v8a` | Modern flagship & mid-range smartphones, modern Android TV boxes | `NexPlay-arm64-v8a.apk` |
| **32-bit APK** | `armeabi-v7a` | Budget Android TV sticks (Firestick, Mi Box), legacy mobile devices | `NexPlay-armeabi-v7a.apk` |
| **Universal APK** | `all ABIs` | Compatible with all Android devices (contains both 32-bit and 64-bit libraries) | `NexPlay-Universal.apk` |

Generated APK binaries are placed in `dist/` and `android/app/build/outputs/apk/release/`.

---

## 🛠️ Building & Compilation Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Java Development Kit (JDK)**: JDK 17 or JDK 21 (recommended for Android Gradle Plugin 8.x)
- **Android SDK**: Build-Tools `35.0.0`, SDK Platforms `android-34` / `android-36`
- **PowerShell**: For automated multi-arch compilation script

### Quick Build (Automated Script)
Run the automated compiler in PowerShell from the project root:

```powershell
# Build Release APKs for all 3 architectures (Universal, 32-bit, 64-bit)
.\build_app.ps1 -BuildType release -SkipInstall -NoLaunch

# Build Debug APKs for testing on connected ADB device
.\build_app.ps1 -BuildType debug
```

### Manual Gradle Build
Alternatively, compile via the native Gradle wrapper:

```bash
# Navigate to Android directory
cd android

# Compile Release APKs (generates universal, arm64-v8a, and armeabi-v7a)
./gradlew assembleRelease

# Output directory:
# android/app/build/outputs/apk/release/
```

---

## 📄 License & Disclaimer

- **License**: Released under the [MIT License](LICENSE).
- **Disclaimer**: NexPlay is an open-source media player interface created for educational and personal media organization purposes. NexPlay does not host, store, or upload any media content or video files on its servers. All media metadata is provided via TMDB and all streams are resolved through user-configured external sources.
