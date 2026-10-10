# Mobile debug log tailing helper
$logPath = Join-Path $PSScriptRoot "..\backend.log"

if (-not (Test-Path $logPath)) {
    Write-Host "NOTE: backend.log not found." -ForegroundColor Yellow
    Write-Host "Backend must be started with output redirect: npm run dev 2>&1 | Tee-Object backend.log" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Waiting for backend.log to appear, or press Ctrl+C to cancel..."
    while (-not (Test-Path $logPath)) {
        Start-Sleep -Seconds 1
    }
}

Write-Host "Tailing backend for mobile requests (Ctrl+C to stop)..." -ForegroundColor Green
Get-Content -Path $logPath -Wait -Tail 0 | Select-String -Pattern "POST|GET|SARVAM|ASR|ERROR|500|400"
