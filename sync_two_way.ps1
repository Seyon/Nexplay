# sync_two_way.ps1
# Bidirectional (Two-Way) Synchronization between Providers-Nexplay and Stitch-nexplay
# Automatically syncs newest updates (here -> there and there -> here) and pushes to GitHub

$ErrorActionPreference = "Stop"

$providersPath = "C:\Users\Ajo\Desktop\Android Projects\Providers-Nexplay"
$stitchPath = "C:\Users\Ajo\Desktop\Android Projects\Stitch-nexplay"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   NEXPLAY TWO-WAY BIDIRECTIONAL PROVIDER SYNCHRONIZATION      " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "HERE (Providers-Nexplay): $providersPath" -ForegroundColor Gray
Write-Host "THERE (Stitch-nexplay):   $stitchPath" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $providersPath)) {
    Write-Host "❌ Providers-Nexplay directory not found at $providersPath" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $stitchPath)) {
    Write-Host "❌ Stitch-nexplay directory not found at $stitchPath" -ForegroundColor Red
    exit 1
}

# 1. Gather all shared candidate files across both repositories
$sharedFiles = @(
    "src\utils\ScraperEngine.js",
    "src\utils\Movies4uProvider.js",
    "src\utils\ExtensionManager.js",
    "src\utils\ProviderBundles.js",
    "src\utils\ProviderUpdateManager.js",
    "src\utils\DnsResolver.js",
    "src\utils\AudioTrackSelector.js",
    "src\utils\PlayerSettingsController.js",
    "src\utils\TvSerialsMetadataCache.js",
    "src\utils\TvSerialsLiveScraper.js",
    "src\components\TvSerialsScreen.js",
    "src\components\BottomTabBar.js",
    "manifest.json",
    "version.json",
    "version_manager.js",
    "build_app.ps1"
)

# Dynamically discover any other utility or test scripts in src/utils
if (Test-Path "$providersPath\src\utils") {
    Get-ChildItem -Path "$providersPath\src\utils" -File | ForEach-Object {
        $rel = "src\utils\" + $_.Name
        if ($sharedFiles -notcontains $rel) {
            $sharedFiles += $rel
        }
    }
}
if (Test-Path "$stitchPath\src\utils") {
    Get-ChildItem -Path "$stitchPath\src\utils" -File | ForEach-Object {
        $rel = "src\utils\" + $_.Name
        # Skip app-only utilities if not related to scrapers/providers
        if ($_.Name -match '(Scraper|Provider|Resolver|Extension|Dns|manifest|test_resolver)') {
            if ($sharedFiles -notcontains $rel) {
                $sharedFiles += $rel
            }
        }
    }
}

# Dynamically discover all modular provider files in src/providers
if (Test-Path "$providersPath\src\providers") {
    Get-ChildItem -Path "$providersPath\src\providers" -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($providersPath.Length + 1)
        if ($sharedFiles -notcontains $rel) {
            $sharedFiles += $rel
        }
    }
}
if (Test-Path "$stitchPath\src\providers") {
    Get-ChildItem -Path "$stitchPath\src\providers" -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($stitchPath.Length + 1)
        if ($sharedFiles -notcontains $rel) {
            $sharedFiles += $rel
        }
    }
}

$syncedCount = 0

foreach ($relPath in $sharedFiles) {
    $hereFile = Join-Path $providersPath $relPath
    $thereFile = Join-Path $stitchPath $relPath

    $hereExists = Test-Path $hereFile
    $thereExists = Test-Path $thereFile

    if ($hereExists -and $thereExists) {
        $hereHash = (Get-FileHash $hereFile).Hash
        $thereHash = (Get-FileHash $thereFile).Hash

        if ($hereHash -eq $thereHash) {
            Write-Host "  [IN SYNC]  $relPath" -ForegroundColor DarkGray
        } else {
            $hereItem = Get-Item $hereFile
            $thereItem = Get-Item $thereFile

            if ($hereItem.LastWriteTimeUtc -gt $thereItem.LastWriteTimeUtc) {
                Write-Host "  [HERE -> THERE] Updating $relPath in Stitch-nexplay (newer in Providers-Nexplay)" -ForegroundColor Yellow
                $destDir = Split-Path $thereFile -Parent
                if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
                Copy-Item -Path $hereFile -Destination $thereFile -Force
                $syncedCount++
            } elseif ($thereItem.LastWriteTimeUtc -gt $hereItem.LastWriteTimeUtc) {
                Write-Host "  [THERE -> HERE] Updating $relPath in Providers-Nexplay (newer in Stitch-nexplay)" -ForegroundColor Green
                $destDir = Split-Path $hereFile -Parent
                if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
                Copy-Item -Path $thereFile -Destination $hereFile -Force
                $syncedCount++
            }
        }
    } elseif ($hereExists -and -not $thereExists) {
        Write-Host "  [HERE -> THERE] Copying new file $relPath to Stitch-nexplay" -ForegroundColor Yellow
        $destDir = Split-Path $thereFile -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
        Copy-Item -Path $hereFile -Destination $thereFile -Force
        $syncedCount++
    } elseif ($thereExists -and -not $hereExists) {
        Write-Host "  [THERE -> HERE] Copying new file $relPath to Providers-Nexplay" -ForegroundColor Green
        $destDir = Split-Path $hereFile -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
        Copy-Item -Path $thereFile -Destination $hereFile -Force
        $syncedCount++
    }
}

# Copy this sync script itself to both locations
Copy-Item -Path "$providersPath\sync_two_way.ps1" -Destination "$stitchPath\sync_two_way.ps1" -Force

Write-Host ""
Write-Host "✅ File synchronization completed ($syncedCount changes processed)." -ForegroundColor Green
Write-Host ""

# 2. Update and Push Providers-Nexplay GitHub Repository
Write-Host "---------------------------------------------------------------" -ForegroundColor DarkCyan
Write-Host "Pushing Providers-Nexplay updates to GitHub..." -ForegroundColor Cyan
try {
    $pStatus = git -C $providersPath status --porcelain
    if ($pStatus) {
        Write-Host "Staging and committing changes in Providers-Nexplay..." -ForegroundColor Yellow
        git -C $providersPath add .
        git -C $providersPath commit -m "sync: two-way provider updates synchronized with Stitch-nexplay"
    } else {
        Write-Host "No uncommitted file changes in Providers-Nexplay." -ForegroundColor DarkGray
    }
    Write-Host "Pushing Providers-Nexplay to origin main..." -ForegroundColor Cyan
    git -C $providersPath push origin main
    Write-Host "✅ Providers-Nexplay GitHub repository up to date!" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Warning updating Providers-Nexplay git: $_" -ForegroundColor Yellow
}

# 3. Update and Push Stitch-nexplay (Nexplay) GitHub Repository
Write-Host "---------------------------------------------------------------" -ForegroundColor DarkCyan
Write-Host "Pushing Stitch-nexplay updates to GitHub..." -ForegroundColor Cyan
try {
    $sStatus = git -C $stitchPath status --porcelain
    if ($sStatus) {
        Write-Host "Staging and committing changes in Stitch-nexplay..." -ForegroundColor Yellow
        git -C $stitchPath add src/utils/ manifest.json sync_two_way.ps1
        # If there are also app files modified, stage them as well
        git -C $stitchPath add App.js src/components/MovieDetailScreen.js app.json android/ assets/
        git -C $stitchPath commit -m "sync: two-way provider updates and player enhancements"
        Write-Host "Pushing Stitch-nexplay to origin main..." -ForegroundColor Cyan
        git -C $stitchPath push origin main
        Write-Host "✅ Stitch-nexplay GitHub repository up to date!" -ForegroundColor Green
    } else {
        Write-Host "No uncommitted changes in Stitch-nexplay." -ForegroundColor DarkGray
    }
} catch {
    Write-Host "⚠️ Warning updating Stitch-nexplay git: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "   TWO-WAY SYNC AND GITHUB REPOSITORY UPDATES COMPLETE!        " -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
