# ==============================================================================
# MediKiosk SIH - One-Click Demo Startup Script
# Automates Ollama verification, MedGemma VRAM pre-warming, backend/frontend
# server initialization in separate visible consoles, and browser launch.
# ==============================================================================

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   MediKiosk SIH - One-Click Demo Launcher" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$RootDir = $PSScriptRoot
if (-not $RootDir) {
    $RootDir = (Get-Location).Path
}

# ------------------------------------------------------------------------------
# 1. Check Ollama
# ------------------------------------------------------------------------------
Write-Host "[1/5] Checking Ollama status at http://127.0.0.1:11434..." -ForegroundColor Yellow
$OllamaRunning = $false
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 3 -ErrorAction Stop
    $OllamaRunning = $true
    Write-Host "      ✓ Ollama is already running." -ForegroundColor Green
} catch {
    Write-Host "      ! Ollama is not running. Starting background instance..." -ForegroundColor DarkYellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    
    # Wait up to 15s for Ollama to become available
    for ($i = 1; $i -le 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
            $OllamaRunning = $true
            Write-Host "      ✓ Ollama started successfully in ${i}s." -ForegroundColor Green
            break
        } catch {
            Write-Host "      ... waiting for Ollama (${i}s)" -ForegroundColor DarkGray
        }
    }
}

if (-not $OllamaRunning) {
    Write-Host "      ✗ Failed to connect to Ollama. Please ensure Ollama is installed and run 'ollama serve'." -ForegroundColor Red
}

# ------------------------------------------------------------------------------
# 2. Warmup MedGemma (pre-load into GPU VRAM with 30m keep-alive)
# ------------------------------------------------------------------------------
Write-Host "[2/5] Pre-warming MedGemma (medgemma1.5:latest) in GPU VRAM..." -ForegroundColor Yellow
try {
    $WarmupBody = @{
        model = "medgemma1.5:latest"
        messages = @(
            @{ role = "user"; content = "warmup ping" }
        )
        stream = $false
        keep_alive = "30m"
        options = @{
            num_predict = 10
        }
    } | ConvertTo-Json -Depth 5

    $warmup = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/chat" -Method Post -Body $WarmupBody -ContentType "application/json" -TimeoutSec 45 -ErrorAction Stop
    Write-Host "      ✓ MedGemma pre-warmed & pinned in VRAM (keep_alive: 30m)." -ForegroundColor Green
} catch {
    Write-Host "      ! MedGemma warmup notice: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------------------
# 3. Start Backend in visible console (Judges terminal)
# ------------------------------------------------------------------------------
Write-Host "[3/5] Launching Backend server in visible terminal..." -ForegroundColor Yellow
$BackendDir = Join-Path $RootDir "backend"
$BackendCmd = "cd `"$BackendDir`"; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd

# ------------------------------------------------------------------------------
# 4. Start Frontend in visible console
# ------------------------------------------------------------------------------
Write-Host "[4/5] Launching Frontend server in visible terminal..." -ForegroundColor Yellow
$FrontendDir = Join-Path $RootDir "frontend"
$FrontendCmd = "cd `"$FrontendDir`"; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd

# ------------------------------------------------------------------------------
# 5. Launch Browser
# ------------------------------------------------------------------------------
Write-Host "[5/5] Waiting 3 seconds for dev servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "      ✓ Opening kiosk demo at http://localhost:5173..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   MediKiosk SIH is now LIVE on http://localhost:5173" -ForegroundColor Green
Write-Host "   Backend terminal is active with live cinematic traces." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
