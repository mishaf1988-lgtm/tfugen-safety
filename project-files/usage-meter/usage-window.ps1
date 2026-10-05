# Claude usage window: a small always-on-top window of claude.ai/settings/usage.
# Chat, Cowork, Code and the desktop app all draw from the same plan limits, and
# this official page shows them (Current session, Weekly limits). Michael,
# 05/10/2026: "it has to work on every platform I open"; he chose "starts by
# itself at login, no debugging port" (no remote control of the window: the
# page is refreshed by itself if it does, otherwise F5 in the window).
#
# Edge in app mode, with its own profile folder (log in to claude.ai once in it).
# Run:      powershell -ExecutionPolicy Bypass -File usage-window.ps1
# At login: install.ps1 puts a shortcut in the Startup folder.
param(
  [int]$Width = 420,
  [int]$Height = 330
)
$ErrorActionPreference = 'Stop'
$url = 'https://claude.ai/settings/usage'
$profileDir = Join-Path $env:LOCALAPPDATA 'ClaudeUsageWindow\profile'
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }

Add-Type @'
using System; using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
}
'@
Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$x = $area.Right - $Width - 8; $y = $area.Bottom - $Height - 8

$edgeArgs = @("--app=$url", "--user-data-dir=$profileDir", "--window-size=$Width,$Height", "--window-position=$x,$y")
Start-Process -FilePath $edge -ArgumentList $edgeArgs | Out-Null

# The app window: the Edge process of this profile with a visible main window.
function Find-Window {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like "*$profileDir*" } |
    ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue } |
    Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
}
$win = $null
for ($i = 0; $i -lt 40 -and -not $win; $i++) { Start-Sleep -Milliseconds 500; $win = Find-Window }
if ($win) {
  # HWND_TOPMOST = -1; SWP_NOMOVE|SWP_NOSIZE = 0x3
  [W]::SetWindowPos($win.MainWindowHandle, [IntPtr](-1), 0, 0, 0, 0, 0x3) | Out-Null
}
