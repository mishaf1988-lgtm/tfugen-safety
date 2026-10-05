# Puts "Claude usage" in the Startup folder (runs usage-window.ps1 hidden at every
# login) and starts it now. Undo: delete the shortcut
#   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Claude usage.lnk
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'usage-window.ps1'
$dst = Join-Path $env:LOCALAPPDATA 'ClaudeUsageWindow\usage-window.ps1'
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
Copy-Item $src $dst -Force
$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'Claude usage.lnk'
$sh = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$sh.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$sh.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$dst`""
$sh.Save()
Start-Process $sh.TargetPath -ArgumentList $sh.Arguments -WindowStyle Hidden
Write-Output "OK: $lnk"
