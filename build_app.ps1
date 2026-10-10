# build_app.ps1
# Automated NexPlay Build & Multi-Architecture Compiler
# Compiles 3 APKs: Universal, 32-bit (armeabi-v7a), and 64-bit (arm64-v8a)
# Auto-updates lengthy version format on successful builds based on update type (bug, issue, minor, major, build)
# Auto-installs and launches on wireless debugging or connected ADB devices

param (
    [ValidateSet('bug', 'bugfix', 'issue', 'patch', 'minor', 'major', 'build')]
    [string]$UpdateType = 'bug',

    [string]$Note = "Debug build with seek diagnostics",

    [ValidateSet('debug', 'release')]
    [string]$BuildType = 'debug',

    [switch]$SkipInstall = $false,
    [switch]$NoLaunch = $false
)

$ErrorActionPreference = "Stop"

# Determine Stitch-nexplay path
$currentDir = (Get-Item -Path ".").FullName
if (Test-Path "$currentDir\android\gradlew.bat") {
    $stitchPath = $currentDir
} elseif (Test-Path "C:\Users\Ajo\Desktop\Android Projects\Stitch-nexplay\android\gradlew.bat") {
    $stitchPath = "C:\Users\Ajo\Desktop\Android Projects\Stitch-nexplay"
} else {
    Write-Host "Error: Could not locate Stitch-nexplay directory with android/gradlew.bat" -ForegroundColor Red
    exit 1
}

if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = "C:\Users\Ajo\AppData\Local\Android\Sdk"
}

$providersPath = "C:\Users\Ajo\Desktop\Android Projects\Providers-Nexplay"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   NEXPLAY MULTI-ARCH COMPILER & AUTO-VERSIONING ENGINE        " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "Project Directory: $stitchPath" -ForegroundColor Gray
Write-Host "Update Category:   $UpdateType" -ForegroundColor Yellow
if ($Note) { Write-Host "Build Note:        $Note" -ForegroundColor Gray }
Write-Host ""

# Step 1: Ensure version_manager exists and stage the next version
$versionManagerPath = Join-Path $stitchPath "version_manager.js"
if (-not (Test-Path $versionManagerPath)) {
    Write-Host "Copying version_manager.js to $stitchPath..." -ForegroundColor Yellow
    Copy-Item "$providersPath\version_manager.js" "$stitchPath\version_manager.js" -Force
}

Write-Host "--- [1/4] Staging Next Lengthy App Version ($UpdateType) ---" -ForegroundColor Cyan
$bumpOutput = & node "$versionManagerPath" bump $UpdateType "$Note"
Write-Host $bumpOutput

# Read staged version from version.json
$versionJsonPath = Join-Path $stitchPath "version.json"
$versionData = Get-Content $versionJsonPath -Raw | ConvertFrom-Json
$stagedVersionName = $versionData.versionName
$stagedVersionCode = $versionData.versionCode

Write-Host "Staged Version Name: $stagedVersionName" -ForegroundColor Green
Write-Host "Staged Version Code: $stagedVersionCode" -ForegroundColor Green
Write-Host ""

# Ensure VLC native patches are applied
$vlcPatchDir = Join-Path $stitchPath "android\vlc_patch"
$vlcTargetDir = Join-Path $stitchPath "node_modules\@lunarr\vlc-player\android\src\main\java\com\lunarr\vlcplayer"
if ((Test-Path $vlcPatchDir) -and (Test-Path $vlcTargetDir)) {
    Get-ChildItem -Path $vlcPatchDir -File | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $vlcTargetDir $_.Name) -Force
    }
    Write-Host "Applied custom VLC native patches from android\vlc_patch." -ForegroundColor Green
}

# Step 2: Compile the 3 APKs via Gradle
$buildTypeCap = (Get-Culture).TextInfo.ToTitleCase($BuildType.ToLower())
$buildTypeLower = $BuildType.ToLower()

Write-Host "--- [2/4] Compiling 3 APK Architectures ($buildTypeCap) ---" -ForegroundColor Cyan
Write-Host "1. Universal APK (All ABIs combined)" -ForegroundColor Yellow
Write-Host "2. 32-bit APK   (armeabi-v7a)" -ForegroundColor Yellow
Write-Host "3. 64-bit APK   (arm64-v8a)" -ForegroundColor Yellow
Write-Host ""

$androidDir = Join-Path $stitchPath "android"
$gradlewBat = Join-Path $androidDir "gradlew.bat"
$buildSuccess = $false

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    Push-Location $androidDir
    Write-Host "Running: .\gradlew.bat assemble$buildTypeCap in $androidDir..." -ForegroundColor DarkCyan
    
    # Run gradlew assembleDebug or assembleRelease
    & $gradlewBat "assemble$buildTypeCap"
    if ($LASTEXITCODE -eq 0) {
        $buildSuccess = $true
    } else {
        throw "Gradle build failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "Gradle Build Failed: $_" -ForegroundColor Red
    $buildSuccess = $false
} finally {
    Pop-Location
}

$stopwatch.Stop()
$elapsedSec = [math]::Round($stopwatch.Elapsed.TotalSeconds, 1)

# Step 3: Handle Build Result & Auto-Increment Commit
Write-Host ""
if ($buildSuccess) {
    Write-Host "--- [3/4] Build Succeeded in ${elapsedSec}s! Committing Version ---" -ForegroundColor Green
    & node "$versionManagerPath" success "$Note"

    # Mirror version.json and build artifacts to Providers-Nexplay if it exists
    if (Test-Path $providersPath) {
        Copy-Item $versionJsonPath "$providersPath\version.json" -Force
        Copy-Item $versionManagerPath "$providersPath\version_manager.js" -Force
    }

    # Verify and format the 3 compiled APKs to requested release format
    $apkDir = Join-Path $androidDir "app\build\outputs\apk\$buildTypeLower"
    $universalApk = Join-Path $apkDir "app-universal-$buildTypeLower.apk"
    $arm32Apk     = Join-Path $apkDir "app-armeabi-v7a-$buildTypeLower.apk"
    $arm64Apk     = Join-Path $apkDir "app-arm64-v8a-$buildTypeLower.apk"

    # Standardized NexPlay release naming format
    $nexplayUniversal = Join-Path $apkDir "NexPlay-Universal.apk"
    $nexplayArm32     = Join-Path $apkDir "NexPlay-armeabi-v7a.apk"
    $nexplayArm64     = Join-Path $apkDir "NexPlay-arm64-v8a.apk"

    if (Test-Path $universalApk) { Copy-Item $universalApk $nexplayUniversal -Force }
    if (Test-Path $arm32Apk)     { Copy-Item $arm32Apk $nexplayArm32 -Force }
    if (Test-Path $arm64Apk)     { Copy-Item $arm64Apk $nexplayArm64 -Force }

    Write-Host ""
    Write-Host "=== COMPILED $buildTypeCap.ToUpper() APKS (TOTAL 3) ===" -ForegroundColor Green

    $apkList = @(
        @{ Name = "Universal App (All ABIs)"; Path = $nexplayUniversal; Arch = "universal" },
        @{ Name = "32-bit App              "; Path = $nexplayArm32;     Arch = "armeabi-v7a" },
        @{ Name = "64-bit App              "; Path = $nexplayArm64;     Arch = "arm64-v8a" }
    )

    foreach ($apk in $apkList) {
        if (Test-Path $apk.Path) {
            $item = Get-Item $apk.Path
            $sizeMb = [math]::Round($item.Length / 1MB, 2)
            Write-Host "  o. $($apk.Name): $($item.Name) (${sizeMb} MB)" -ForegroundColor Cyan
            Write-Host "      Location: $($item.FullName)" -ForegroundColor DarkGray
        } else {
            Write-Host "  ?O Missing expected APK: $($apk.Path)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "--- [3/4] Build Failed! Reverting Version Changes ---" -ForegroundColor Red
    & node "$versionManagerPath" revert
    exit 1
}

# Step 4: Wireless Debugging / Connected Device Deployment
Write-Host ""
Write-Host "--- [4/4] Wireless Debugging & Connected ADB Deployment ---" -ForegroundColor Cyan

if ($SkipInstall) {
    Write-Host "Skipping device installation as -SkipInstall was specified." -ForegroundColor DarkGray
    exit 0
}

try {
    $devicesOutput = adb devices
    $deviceLines = ($devicesOutput -split "`r?`n") | Where-Object { $_ -match '\tdevice$' }

    if (-not $deviceLines -or $deviceLines.Count -eq 0) {
        Write-Host "No active ADB or Wireless Debugging devices connected." -ForegroundColor Yellow
        Write-Host "Compiled APKs are ready for manual installation in:" -ForegroundColor DarkGray
        Write-Host "  $apkDir" -ForegroundColor DarkGray
        exit 0
    }

    foreach ($devLine in $deviceLines) {
        $devId = ($devLine -split '\tdevice')[0].Trim()
        Write-Host "Connected Device Found: $devId" -ForegroundColor Green

        # Check device CPU ABI
        $devAbi = (adb -s "$devId" shell getprop ro.product.cpu.abi).Trim()
        $devModel = (adb -s "$devId" shell getprop ro.product.model).Trim()
        $androidVer = (adb -s "$devId" shell getprop ro.build.version.release).Trim()
        Write-Host "Device Details: $devModel (Android $androidVer, Primary ABI: $devAbi)" -ForegroundColor Cyan

        # Select matching APK in standardized format
        $targetApk = $null
        if ($devAbi -eq "arm64-v8a" -and (Test-Path $nexplayArm64)) {
            $targetApk = $nexplayArm64
            Write-Host "Targeting optimized 64-bit APK: NexPlay-arm64-v8a.apk" -ForegroundColor Yellow
        } elseif ($devAbi -eq "armeabi-v7a" -and (Test-Path $nexplayArm32)) {
            $targetApk = $nexplayArm32
            Write-Host "Targeting optimized 32-bit APK: NexPlay-armeabi-v7a.apk" -ForegroundColor Yellow
        } elseif (Test-Path $nexplayUniversal) {
            $targetApk = $nexplayUniversal
            Write-Host "Targeting Universal APK: NexPlay-Universal.apk" -ForegroundColor Yellow
        }

        if ($targetApk) {
            Write-Host "Installing $targetApk to $devId over Wireless Debugging (User 0)..." -ForegroundColor Cyan
            $installResult = adb -s "$devId" install --user 0 -r -d "$targetApk"
            Write-Host "Install Result: $installResult" -ForegroundColor Green

            if (-not $NoLaunch) {
                Write-Host "Launching NexPlay ($stagedVersionName) on device (User 0)..." -ForegroundColor Cyan
                adb -s "$devId" shell am start --user 0 -n com.anonymous.Stitchnexplay/.MainActivity
                Write-Host "o. NexPlay launched successfully!" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "Warning during device deployment: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "   NEXPLAY COMPILE, VERSION UPDATE & DEPLOYMENT COMPLETE!      " -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green

