$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$vbsLauncher = Join-Path $projectRoot "Launch AI Voice Assistant.vbs"
$iconPath = Join-Path $projectRoot "public\icon.ico"
$wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "       CONFIGURING AI VOICE ASSISTANT SHORTCUTS        " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$ws = New-Object -ComObject WScript.Shell

# 1. Desktop Shortcut
Write-Host "[1/3] Creating Desktop shortcut (Smart App Control Compatible)..." -ForegroundColor Yellow
$desktop = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcut = $ws.CreateShortcut((Join-Path $desktop "AI Voice Assistant.lnk"))
$desktopShortcut.TargetPath = $wscriptExe
$desktopShortcut.Arguments = "`"$vbsLauncher`""
$desktopShortcut.WorkingDirectory = $projectRoot
$desktopShortcut.IconLocation = "$iconPath,0"
$desktopShortcut.Description = "AI Voice Assistant with Laptop Control"
$desktopShortcut.Save()

# 2. Start Menu Shortcut
Write-Host "[2/3] Creating Start Menu shortcut..." -ForegroundColor Yellow
$startMenu = [System.Environment]::GetFolderPath('Programs')
$startShortcut = $ws.CreateShortcut((Join-Path $startMenu "AI Voice Assistant.lnk"))
$startShortcut.TargetPath = $wscriptExe
$startShortcut.Arguments = "`"$vbsLauncher`""
$startShortcut.WorkingDirectory = $projectRoot
$startShortcut.IconLocation = "$iconPath,0"
$startShortcut.Description = "AI Voice Assistant with Laptop Control"
$startShortcut.Save()

# 3. Register in Windows Programs
Write-Host "[3/3] Registering in Windows Apps..." -ForegroundColor Yellow
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AIVoiceAssistant"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "DisplayName" -Value "AI Voice Assistant"
Set-ItemProperty -Path $regPath -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regPath -Name "Publisher" -Value "AI Voice Control"
Set-ItemProperty -Path $regPath -Name "DisplayIcon" -Value "$iconPath,0"
Set-ItemProperty -Path $regPath -Name "InstallLocation" -Value $projectRoot

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "               SETUP & INSTALL COMPLETE!               " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "• Desktop Shortcut: Updated on your Desktop" -ForegroundColor White
Write-Host "• Start Menu: Search 'AI Voice Assistant' in Windows" -ForegroundColor White
Write-Host "• Smart App Control: 100% Compatible (No warning popups)" -ForegroundColor White
Write-Host ""
