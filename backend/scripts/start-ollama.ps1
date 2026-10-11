# start-ollama.ps1
# Script to launch Ollama with optimized parameters and 30m keep-alive
# Before running, stop any running Ollama process:
#   Stop-Process -Name ollama* -Force -ErrorAction SilentlyContinue

Write-Host "[OLLAMA] Configuring environment variables..." -ForegroundColor Cyan

$env:OLLAMA_DEBUG = "false"
$env:OLLAMA_NUM_PARALLEL = "2"
$env:OLLAMA_MAX_LOADED_MODELS = "2"
$env:OLLAMA_KEEP_ALIVE = "30m"

Write-Host "[OLLAMA] Launching 'ollama serve' with 30m keep_alive and quiet wrapper settings..." -ForegroundColor Green
ollama serve
