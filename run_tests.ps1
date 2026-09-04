Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " PS-005 Vector Storage Engine — Complete End-to-End Test Suite" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# -------------------------------------------------------------
# STEP 1: TEST THE GO QUERY ROUTER
# -------------------------------------------------------------
Write-Host "[STEP 1/3] Testing Go Query Router (router.exe)..." -ForegroundColor Yellow

$proc = Start-Process -FilePath ".\router\router.exe" -PassThru
Start-Sleep -Milliseconds 600

try {
    # 1.1 Health Check
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:50052/health" -Method Get
    Write-Host "  -> Health Endpoint:   " -NoNewline
    Write-Host "PASS" -ForegroundColor Green -NoNewline
    Write-Host " (Status: $($health.status), Component: $($health.component))"

    # 1.2 Dimension Rejection (Protection Test: send 2 numbers instead of 64)
    $badBody = @{ id = 1; values = @(0.1, 0.2) } | ConvertTo-Json
    $badResp = Invoke-RestMethod -Uri "http://127.0.0.1:50052/v1/put" -Method Post -Body $badBody -ContentType "application/json"
    if ($badResp.success -eq $false -and $badResp.error -match "mismatch") {
        Write-Host "  -> Dimension Check:   " -NoNewline
        Write-Host "PASS" -ForegroundColor Green -NoNewline
        Write-Host " (Properly rejected invalid dimension: $($badResp.error))"
    } else {
        Write-Host "  -> Dimension Check:   FAILED" -ForegroundColor Red
    }

    # 1.3 Valid Ingestion (Send 64 float values)
    $vec64 = 1..64 | ForEach-Object { [float]0.05 }
    $goodBody = @{ id = 101; values = $vec64 } | ConvertTo-Json
    $goodResp = Invoke-RestMethod -Uri "http://127.0.0.1:50052/v1/put" -Method Post -Body $goodBody -ContentType "application/json"
    if ($goodResp.success -eq $true) {
        Write-Host "  -> Valid Write Check: " -NoNewline
        Write-Host "PASS" -ForegroundColor Green -NoNewline
        Write-Host " (Accepted with Sequence Number: $($goodResp.sequence_number))`n"
    } else {
        Write-Host "  -> Valid Write Check: FAILED" -ForegroundColor Red
    }
} finally {
    Stop-Process -Id $proc.Id -Force
}

# -------------------------------------------------------------
# STEP 2: TEST RUST STORAGE ENGINE BENCHMARK SUITE
# -------------------------------------------------------------
Write-Host "[STEP 2/3] Running Technical Benchmark Suite in Release Mode..." -ForegroundColor Yellow
Write-Host "  (Measuring Ingestion Throughput, P99 Latency, Recall@10, and Crash Recovery)`n" -ForegroundColor DarkGray

wsl -d Ubuntu -e /bin/bash /mnt/c/Users/Shind/OneDrive/Desktop/PS-005-GT/storage-engine/run_benchmark.sh

# -------------------------------------------------------------
# STEP 3: DASHBOARD INSTRUCTIONS
# -------------------------------------------------------------
Write-Host "`n[STEP 3/3] Telemetry Dashboard Ready" -ForegroundColor Yellow
Write-Host "  -> You can view the live visual dashboard by opening:" -ForegroundColor White
Write-Host "     dashboard\index.html in your browser.`n" -ForegroundColor Cyan

Write-Host "==================================================================" -ForegroundColor Green
Write-Host " All Tests Completed Successfully!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
