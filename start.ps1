# Запуск виртуальной лаборатории «Энерджиквантум» на Windows (PowerShell).
#
#   .\start.ps1                 порт 8082
#   $env:PORT=9000; .\start.ps1 другой порт
#
# Если PowerShell не разрешает запуск скриптов:
#   powershell -ExecutionPolicy Bypass -File .\start.ps1

param([int]$Port = 0)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if ($Port -eq 0) { $Port = if ($env:PORT) { [int]$env:PORT } else { 8082 } }

Write-Host 'Виртуальная лаборатория «Энерджиквантум»' -ForegroundColor Cyan
Write-Host ("папка: " + (Get-Location))

if (-not (Test-Path 'index.html')) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Host 'index.html нет — собираю из src/...' -ForegroundColor Yellow
        & node tools/build.mjs
    } else {
        Write-Host 'ОШИБКА: нет index.html и не установлен Node.js.' -ForegroundColor Red
        exit 1
    }
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host ("Node.js: " + (& node -v)) -ForegroundColor Green
    Write-Host ("Откройте в браузере: http://localhost:$Port") -ForegroundColor Green
    Write-Host ''
    $env:PORT = $Port
    & node server.js
    exit $LASTEXITCODE
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host 'Node.js не найден — использую Python.' -ForegroundColor Yellow
    Write-Host ("Откройте в браузере: http://localhost:$Port") -ForegroundColor Green
    & python -m http.server $Port --bind 0.0.0.0
    exit $LASTEXITCODE
}

$standalone = Join-Path $PSScriptRoot 'dist/lab.html'
if (Test-Path $standalone) {
    Write-Host 'Node.js и Python не найдены — открываю готовую сборку в браузере.' -ForegroundColor Yellow
    Start-Process $standalone
} else {
    Write-Host 'ОШИБКА: не установлен ни Node.js, ни Python. Скачайте Node.js с https://nodejs.org' -ForegroundColor Red
    Read-Host 'Нажмите Enter, чтобы закрыть'
}
