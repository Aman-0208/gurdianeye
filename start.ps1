# GuardianEye — Windows Startup Script (FIXED)

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "     GuardianEye Startup v1.0      " -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start MongoDB (SMART CHECK)
Write-Host "[1/4] Starting MongoDB..." -ForegroundColor Yellow

$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue

if ($mongoService -and $mongoService.Status -eq "Running") {
    Write-Host "      [OK] MongoDB already running" -ForegroundColor Green
}
else {
    try {
        Start-Service -Name "MongoDB" -ErrorAction Stop
        Write-Host "      [OK] MongoDB service started" -ForegroundColor Green
    }
    catch {
        Write-Host "      [WARNING] MongoDB could not be started (run as admin if needed)" -ForegroundColor Yellow
    }
}

Start-Sleep -Seconds 2

# 2. Start Python AI Service (WITH VENV)
Write-Host "[2/4] Starting Python AI Service on port 5001..." -ForegroundColor Yellow
$aiServicePath = Join-Path $RootDir "ai_service"

if (Test-Path $aiServicePath) {
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k cd /d `"$aiServicePath`" && venv\Scripts\activate && python app.py" `
        -WorkingDirectory $aiServicePath `
        -WindowStyle Normal

    Write-Host "      [OK] Python AI Service launched (venv active)" -ForegroundColor Green
} else {
    Write-Host "      [ERROR] ai_service folder not found" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# 3. Start Node.js Server
Write-Host "[3/4] Starting Node.js server on port 4000..." -ForegroundColor Yellow
$serverPath = Join-Path $RootDir "server"

if (Test-Path $serverPath) {

    if (-not (Test-Path (Join-Path $serverPath "node_modules"))) {
        Write-Host "      Installing server dependencies..." -ForegroundColor Gray
        Push-Location $serverPath
        cmd /c npm install
        Pop-Location
    }

    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $serverPath `
        -WindowStyle Normal -PassThru | Out-Null

    Write-Host "      [OK] Node.js server launched" -ForegroundColor Green
} else {
    Write-Host "      [ERROR] server folder not found" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# 4. Start React Client
Write-Host "[4/4] Starting React client on port 5173..." -ForegroundColor Yellow
$clientPath = Join-Path $RootDir "client"

if (Test-Path $clientPath) {

    if (-not (Test-Path (Join-Path $clientPath "node_modules"))) {
        Write-Host "      Installing client dependencies..." -ForegroundColor Gray
        Push-Location $clientPath
        cmd /c npm install
        Pop-Location
    }

    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $clientPath `
        -WindowStyle Normal -PassThru | Out-Null

    Write-Host "      [OK] React client launched" -ForegroundColor Green
} else {
    Write-Host "      [ERROR] client folder not found" -ForegroundColor Red
}

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "All services started!" -ForegroundColor Green
Write-Host "Open your browser at: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:5173"