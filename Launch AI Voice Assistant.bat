@echo off
title AI Voice Assistant Desktop Launcher
cd /d "%~dp0"

echo =======================================================
echo          AI VOICE ASSISTANT - DESKTOP EDITION         
echo =======================================================
echo.
echo [*] Launching AI Voice Assistant Desktop App (Port 6000)...
echo [*] Electron will automatically manage local services.
echo.

if exist "dist_electron\AI Voice Assistant-Portable.exe" (
    start "" "dist_electron\AI Voice Assistant-Portable.exe"
) else if exist "dist_electron\win-unpacked\AI Voice Assistant.exe" (
    start "" "dist_electron\win-unpacked\AI Voice Assistant.exe"
) else (
    start "" npx electron .
)

exit
