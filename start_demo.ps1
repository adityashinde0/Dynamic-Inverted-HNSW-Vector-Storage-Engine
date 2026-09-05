# ==============================================================================
# PS-005 Vector Storage Engine — One-Click Hackathon Demo Launcher
# ==============================================================================

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " PS-005 Vector Storage Engine — Launching Live Demo System" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Go Query Router on 127.0.0.1:50052
Write-Host "[1/3] Starting Go Query Router..." -ForegroundColor Yellow
$routerProc = Start-Process -FilePath ".\router\router.exe" -PassThru -WindowStyle Hidden
Write-Host "  -> Go Router running on http://127.0.0.1:50052" -ForegroundColor Green

# 2. Check if Storage Engine is already running on port 8080
$tcpCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 8080 -WarningAction SilentlyContinue
if ($tcpCheck.TcpTestSucceeded -ne $true) {
    Write-Host "[2/3] Booting Rust Vector Storage Engine in WSL..." -ForegroundColor Yellow
    $wslScript = "cd /mnt/c/Users/Shind/OneDrive/Desktop/PS-005-GT; ./storage-engine/target/release/storage_server"
    Start-Process -FilePath "wsl" -ArgumentList "-d", "Ubuntu", "-e", "/bin/bash", "-c", $wslScript -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/3] Storage Engine already active on http://127.0.0.1:8080" -ForegroundColor Green
}

# 3. Launch Web Browser
Write-Host "[3/3] Launching Technical Blueprint Control Room..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:8080/index.html"

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " PS-005 Demo is Live at: http://127.0.0.1:8080/index.html" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "System is operational. You can close this window at any time."

# End of script
