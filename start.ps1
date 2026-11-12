# Hikma JobTrack PowerShell Launcher
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Hikma JobTrack Application..." -ForegroundColor Cyan
Write-Host "  Primary Theme: Light Blue (#0284c7)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$nodeCmd = "node"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $fallback = "$env:LOCALAPPDATA\OpenAI\Codex\runtimes\cua_node\bbc9141fe9f920ac\bin\node.exe"
    if (Test-Path $fallback) {
        $nodeCmd = $fallback
    } else {
        Write-Error "Node.js executable was not found. Please install Node.js."
        exit 1
    }
}

Write-Host "Starting server..." -ForegroundColor Green
Start-Process "http://localhost:3000"
& $nodeCmd server.js

