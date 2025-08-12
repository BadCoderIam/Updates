Option Explicit

Dim fso, shell, psExe, psArgs, cmd, logPath, ts, rc, toolsRoot, ps1
Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

toolsRoot = "C:\IntuneTools"
ps1       = toolsRoot & "\MainMenu.ps1"
logPath   = toolsRoot & "\MainMenu_launch.log"

' Force 64-bit PowerShell (avoids SysWOW64 redirection issues)
psExe = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")

' Validate basics and log
If Not fso.FolderExists(toolsRoot) Then fso.CreateFolder toolsRoot
Set ts = fso.OpenTextFile(logPath, 8, True) ' append
ts.WriteLine Now & "  starting launcher…"
ts.WriteLine "  powershell: " & psExe
ts.WriteLine "  script:     " & ps1

If Not fso.FileExists(ps1) Then
  ts.WriteLine "  ERROR: MainMenu.ps1 not found."
  ts.Close
  MsgBox "MainMenu.ps1 not found at: " & ps1, vbExclamation, "Launcher"
  WScript.Quit 1
End If

' Build args (hidden, STA)
psArgs = " -NoProfile -ExecutionPolicy Bypass -STA -File """ & ps1 & """"
cmd    = """" & psExe & """" & psArgs

ts.WriteLine "  cmd:        " & cmd

' Launch hidden (0=hidden, False=do not wait)
rc = shell.Run(cmd, 0, False)
ts.WriteLine "  shell.Run rc=" & rc
ts.Close
