# sync_to_providers.ps1
# Synchronizes active scraper engine files from Stitch-nexplay to Providers-Nexplay repository

$source = "src\utils"
$destination = "C:\Users\Ajo\Desktop\Android Projects\Providers-Nexplay\src\utils"
$rootDestination = "C:\Users\Ajo\Desktop\Android Projects\Providers-Nexplay"

Write-Host "[NexPlay Sync] Syncing scraper files to Providers-Nexplay: $destination..." -ForegroundColor Cyan

if (-not (Test-Path $destination)) {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
}

$files = @(
    "ScraperEngine.js",
    "Movies4uProvider.js",
    "ExtensionManager.js",
    "DnsResolver.js",
    "ProviderBundles.js",
    "ProviderUpdateManager.js"
)

foreach ($file in $files) {
    if (Test-Path "$source\$file") {
        Copy-Item -Path "$source\$file" -Destination "$destination\$file" -Force
        Write-Host "  -> Synced $file" -ForegroundColor Green
    }
}

if (Test-Path "manifest.json") {
    Copy-Item -Path "manifest.json" -Destination "$rootDestination\manifest.json" -Force
    Write-Host "  -> Synced manifest.json" -ForegroundColor Green
}

if (Test-Path "version.json") {
    Copy-Item -Path "version.json" -Destination "$rootDestination\version.json" -Force
    Write-Host "  -> Synced version.json" -ForegroundColor Green
}

if (Test-Path "src\providers") {
    Copy-Item -Path "src\providers\*" -Destination "$rootDestination\src\providers" -Recurse -Force
    Write-Host "  -> Synced src\providers" -ForegroundColor Green
}

Write-Host "✅ All scraper files successfully updated on Providers-Nexplay repository path!" -ForegroundColor Green
