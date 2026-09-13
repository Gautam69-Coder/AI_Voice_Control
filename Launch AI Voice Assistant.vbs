Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strScriptDir

strUnpacked = strScriptDir & "\dist_electron\win-unpacked\AI Voice Assistant.exe"
strPortable = strScriptDir & "\dist_electron\AI Voice Assistant-Portable-1.0.0.exe"

If FSO.FileExists(strUnpacked) Then
    WshShell.Run """" & strUnpacked & """", 1, False
ElseIf FSO.FileExists(strPortable) Then
    WshShell.Run """" & strPortable & """", 1, False
Else
    WshShell.Run "cmd /c npx electron .", 0, False
End If
