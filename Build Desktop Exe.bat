@echo off
title Build AI Voice Assistant .EXE
cd /d "%~dp0"

echo =======================================================
echo          BUILDING AI VOICE ASSISTANT .EXE             
echo =======================================================
echo.
echo [1/2] Packaging Portable Executable and NSIS Installer...
echo.

call pnpm run electron:dist

echo.
echo =======================================================
echo                 BUILD COMPLETE!                        
echo =======================================================
echo.
echo Your .exe files are ready in the "dist_electron" folder:
echo.
echo 1. Portable Single-File App (No install needed):
echo    dist_electron\AI Voice Assistant-Portable-1.0.0.exe
echo.
echo 2. Full Windows Installer (Start Menu + Desktop Shortcut):
echo    dist_electron\AI Voice Assistant Setup 1.0.0.exe
echo.
echo 3. Unpacked Executable Folder:
echo    dist_electron\win-unpacked\AI Voice Assistant.exe
echo.
explorer dist_electron
echo.
pause
