@echo off
title AI Voice Assistant Desktop Launcher
cd /d "%~dp0"

echo =======================================================
echo          AI VOICE ASSISTANT - DESKTOP EDITION         
echo =======================================================
echo.
echo [*] Starting Web Server & Python Voice Agent...
echo.

:: Start Next.js web frontend and Python Voice Agent concurrently
start /B pnpm run dev

:: Wait for the local server to be ready on port 3000
echo [*] Waiting for assistant services to become available on http://localhost:3000...
:wait_loop
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

echo [*] Services online! Launching AI Voice Assistant Desktop App...
echo.

:: Launch the packaged executable
if exist "dist_electron\win-unpacked\AI Voice Assistant.exe" (
    start "" "dist_electron\win-unpacked\AI Voice Assistant.exe"
) else if exist "dist_electron\AI Voice Assistant-Portable-1.0.0.exe" (
    start "" "dist_electron\AI Voice Assistant-Portable-1.0.0.exe"
) else (
    echo [*] Executable not found in dist_electron. Launching via electron dev mode...
    pnpm run electron
)

echo [*] Desktop Assistant is running!
echo [*] You can minimize this launcher window or close it when done.
echo.
pause
