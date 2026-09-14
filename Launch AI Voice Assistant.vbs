Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strScriptDir

' Launch through official signed Electron runtime in hidden mode (0 = hide console)
' This guarantees 100% compatibility with Windows 11 Smart App Control (no unsigned .exe block)
WshShell.Run "cmd /c npx electron .", 0, False
