@echo off
title Install AI Voice Assistant
cd /d "%~dp0"

echo =======================================================
echo          AI VOICE ASSISTANT - WINDOWS INSTALLER        
echo =======================================================
echo.
echo Installing AI Voice Assistant to your PC...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install_app.ps1"

echo.
echo Launching installed AI Voice Assistant...
start "" "%LOCALAPPDATA%\Programs\AI Voice Assistant\AI Voice Assistant.exe"

timeout /t 3 >nul
exit
