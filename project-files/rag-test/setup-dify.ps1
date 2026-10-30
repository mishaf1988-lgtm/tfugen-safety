# Sets up Dify (version 1.18.0) for the ammonia-procedures retrieval test. Windows, needs Docker Desktop running.
$ErrorActionPreference = "Stop"
$root = Join-Path $env:USERPROFILE "dify-test"
$zip  = Join-Path $root "dify.zip"

docker version | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker Desktop is not running. Start it, wait for Running, and run this again."; exit 1 }

New-Item -ItemType Directory -Force -Path $root | Out-Null
if (-not (Test-Path (Join-Path $root "dify-1.18.0"))) {
    Write-Host "Downloading Dify..."
    Invoke-WebRequest -Uri "https://github.com/langgenius/dify/archive/refs/tags/1.18.0.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $root -Force
}
$dir = Join-Path $root "dify-1.18.0\docker"
Set-Location $dir
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Write-Host "Starting Dify. The first run downloads a few GB and takes several minutes..."
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Host "docker compose failed. Send a screenshot of this window."; exit 1 }

Start-Sleep -Seconds 30
Start-Process "http://localhost/install"
Write-Host "Done. Create the admin user in the browser. To stop: docker compose down (in $dir)."
