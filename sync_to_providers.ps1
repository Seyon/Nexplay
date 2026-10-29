# sync_to_providers.ps1
# Comprehensive synchronization from Stitch-nexplay to Providers-Nexplay repository

$source = "src\utils"
$destination = "C:\Users\Ajo\Desktop\Android Projects\Providers-Nexplay\src\utils"
$rootDestination = "C:\Users\Ajo\Desktop\Android Projects\Providers-Nexplay"

Write-Host "[NexPlay Sync] Syncing files to Providers-Nexplay: $rootDestination..." -ForegroundColor Cyan

if (-not (Test-Path $destination)) {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
}

# 1. Sync all files in src/utils
if (Test-Path "src\utils") {
    Copy-Item -Path "src\utils\*" -Destination "$rootDestination\src\utils" -Recurse -Force
    Write-Host "  -> Synced src\utils" -ForegroundColor Green
}

# 2. Sync all modular providers in src/providers
if (Test-Path "src\providers") {
    Copy-Item -Path "src\providers\*" -Destination "$rootDestination\src\providers" -Recurse -Force
    Write-Host "  -> Synced src\providers" -ForegroundColor Green
}

# 3. Sync config and theme
if (Test-Path "src\config") {
    if (-not (Test-Path "$rootDestination\src\config")) {
        New-Item -ItemType Directory -Force -Path "$rootDestination\src\config" | Out-Null
    }
    Copy-Item -Path "src\config\*" -Destination "$rootDestination\src\config" -Recurse -Force
    Write-Host "  -> Synced src\config" -ForegroundColor Green
}

# 4. Sync shared components
$components = @(
    "AccountScreen.js",
    "BottomTabBar.js",
    "DonationModal.js",
    "MovieDetailScreen.js",
    "MoviesScreen.js",
    "TmdbApiKeyModal.js",
    "TvSerialsScreen.js",
    "TvSeriesScreen.js"
)
foreach ($comp in $components) {
    if (Test-Path "src\components\$comp") {
        Copy-Item -Path "src\components\$comp" -Destination "$rootDestination\src\components\$comp" -Force
        Write-Host "  -> Synced src\components\$comp" -ForegroundColor Green
    }
}

# 5. Sync root metadata & build files
$rootFiles = @("manifest.json", "version.json", "version_manager.js", "build_app.ps1", "sync_two_way.ps1", "sync_to_providers.ps1", "App.js")
foreach ($rf in $rootFiles) {
    if (Test-Path $rf) {
        Copy-Item -Path $rf -Destination "$rootDestination\$rf" -Force
        Write-Host "  -> Synced $rf" -ForegroundColor Green
    }
}

Write-Host "✅ All files successfully updated on Providers-Nexplay repository path!" -ForegroundColor Green

