@echo off
title Build AI Voice Assistant .EXE
cd /d "%~dp0"

echo =======================================================
echo          BUILDING AI VOICE ASSISTANT .EXE             
echo =======================================================
echo.
echo [1/1] Packaging Portable Executable...
echo.

call node scripts/build_electron.js --win portable

echo.
echo =======================================================
echo                 BUILD COMPLETE!                        
echo =======================================================
echo.
echo Your fresh .exe files are ready in "dist_electron":
echo.
echo 1. Portable Single-File App (Direct Launch):
echo    dist_electron\AI Voice Assistant-Portable.exe
echo.
echo 2. Unpacked Executable:
echo    dist_electron\win-unpacked\AI Voice Assistant.exe
echo.
explorer dist_electron
echo.
pause
