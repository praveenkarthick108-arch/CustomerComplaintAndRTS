# Customer Complaint & Resolution Tracking System - Start Script
$bun = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe"

if (-not (Test-Path $bun)) {
  Write-Error "Bun not found. Install from https://bun.sh"
  exit 1
}

$rootDir = $PSScriptRoot

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Customer Complaint Tracker - Starting..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Kill any existing processes on ports 3001 and 5173
$proc3001 = (netstat -ano | Select-String ":3001 .*LISTENING") -replace ".*LISTENING\s+", ""
if ($proc3001) {
  try { Stop-Process -Id ([int]$proc3001.Trim()) -Force -ErrorAction SilentlyContinue } catch {}
}

# Start backend
Write-Host "`nStarting Backend (port 3001)..." -ForegroundColor Yellow
$backendProc = Start-Process -FilePath $bun -ArgumentList "server.js" -WorkingDirectory "$rootDir\backend" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

# Test backend
try {
  $health = (Invoke-WebRequest "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
  if ($health.success) {
    Write-Host "Backend running at http://localhost:3001" -ForegroundColor Green
  }
} catch {
  Write-Host "Warning: Backend health check failed" -ForegroundColor Red
}

# Start frontend
Write-Host "Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontendProc = Start-Process -FilePath $bun -ArgumentList "run", "dev" -WorkingDirectory "$rootDir\frontend" -PassThru -NoNewWindow

Start-Sleep -Seconds 5
Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "  App is running!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "`n  Demo Credentials:" -ForegroundColor Yellow
Write-Host "  Admin:      admin@system.com / Admin@123" -ForegroundColor White
Write-Host "  Supervisor: supervisor@system.com / Admin@123" -ForegroundColor White
Write-Host "  Agent:      agent1@system.com / Admin@123" -ForegroundColor White
Write-Host "  Customer:   customer@system.com / Admin@123" -ForegroundColor White
Write-Host "`n  Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"
Write-Host "`n  Press Ctrl+C or close this window to stop." -ForegroundColor Gray

# Keep script running
try { Wait-Process -Id $backendProc.Id } catch {}
