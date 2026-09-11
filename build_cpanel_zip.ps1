# ==============================================================================
# McGate Workforce - Automated cPanel Deployment Packaging Script
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " McGate Workforce - Packaging for cPanel Passenger" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$ROOT_DIR = $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$TEMPLATES_DIST = Join-Path $BACKEND_DIR "templates\dist"
$ZIP_OUTPUT = Join-Path $ROOT_DIR "cpanel-mcgate-workforce.zip"
$STAGING_DIR = Join-Path $ROOT_DIR "cpanel_staging"

# 1. Compile Vite Frontend
Write-Host "`n[1/5] Compiling production frontend bundle..." -ForegroundColor Yellow
Set-Location $ROOT_DIR
cmd.exe /c "npx vite build"

# 2. Sync distribution assets into backend/templates/dist/
Write-Host "`n[2/5] Syncing compiled assets into backend/templates/dist/..." -ForegroundColor Yellow
if (-not (Test-Path $TEMPLATES_DIST)) {
    New-Item -ItemType Directory -Path $TEMPLATES_DIST -Force | Out-Null
}

$DIST_DIR = Join-Path $ROOT_DIR "dist"
if (Test-Path $DIST_DIR) {
    Copy-Item -Path "$DIST_DIR\*" -Destination $TEMPLATES_DIST -Recurse -Force
    Write-Host "  -> Frontend assets synced successfully." -ForegroundColor Green
} else {
    Write-Error "Error: dist directory not found after build."
}

# 3. Verify Django Configuration
Write-Host "`n[3/5] Verifying Django configuration and database..." -ForegroundColor Yellow
$PYTHON = Join-Path $ROOT_DIR "venv\Scripts\python.exe"
if (-not (Test-Path $PYTHON)) {
    $PYTHON = "python"
}

& $PYTHON "$BACKEND_DIR\manage.py" check
& $PYTHON "$BACKEND_DIR\manage.py" seed_enterprise

# 4. Prepare Clean Staging Folder
Write-Host "`n[4/5] Assembling cPanel deployment files..." -ForegroundColor Yellow
if (Test-Path $STAGING_DIR) {
    Remove-Item -Path $STAGING_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $STAGING_DIR -Force | Out-Null

# Copy Root Files
Copy-Item (Join-Path $ROOT_DIR "passenger_wsgi.py") -Destination $STAGING_DIR
Copy-Item (Join-Path $ROOT_DIR "requirements.txt") -Destination $STAGING_DIR
if (Test-Path (Join-Path $ROOT_DIR ".env.example")) {
    Copy-Item (Join-Path $ROOT_DIR ".env.example") -Destination (Join-Path $STAGING_DIR ".env.example")
}

# Copy Backend Files (excluding __pycache__)
$STAGING_BACKEND = Join-Path $STAGING_DIR "backend"
New-Item -ItemType Directory -Path $STAGING_BACKEND -Force | Out-Null

Copy-Item -Path (Join-Path $BACKEND_DIR "manage.py") -Destination $STAGING_BACKEND
Copy-Item -Path (Join-Path $BACKEND_DIR "passenger_wsgi.py") -Destination $STAGING_BACKEND
Copy-Item -Path (Join-Path $BACKEND_DIR "requirements.txt") -Destination $STAGING_BACKEND
Copy-Item -Path (Join-Path $BACKEND_DIR "apps") -Destination $STAGING_BACKEND -Recurse
Copy-Item -Path (Join-Path $BACKEND_DIR "mcgate_backend") -Destination $STAGING_BACKEND -Recurse
Copy-Item -Path (Join-Path $BACKEND_DIR "templates") -Destination $STAGING_BACKEND -Recurse
Copy-Item -Path (Join-Path $BACKEND_DIR "data") -Destination $STAGING_BACKEND -Recurse

# Clean __pycache__ from staging
Get-ChildItem -Path $STAGING_DIR -Filter "__pycache__" -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $STAGING_DIR -Filter "*.pyc" -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue

# 5. Compress into ZIP archive
Write-Host "`n[5/5] Compressing into $ZIP_OUTPUT..." -ForegroundColor Yellow
if (Test-Path $ZIP_OUTPUT) {
    Remove-Item -Path $ZIP_OUTPUT -Force
}

Compress-Archive -Path "$STAGING_DIR\*" -DestinationPath $ZIP_OUTPUT -CompressionLevel Optimal

# Cleanup temporary staging folder
Remove-Item -Path $STAGING_DIR -Recurse -Force

$ZIP_SIZE = (Get-Item $ZIP_OUTPUT).Length / 1MB
Write-Host "`n==================================================" -ForegroundColor Green
Write-Host " cPanel Deployment Package Created Successfully!" -ForegroundColor Green
Write-Host " Archive: $ZIP_OUTPUT" -ForegroundColor Green
Write-Host " Size: $([math]::Round($ZIP_SIZE, 2)) MB" -ForegroundColor Green
Write-Host " Ready to upload directly to cPanel File Manager!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
