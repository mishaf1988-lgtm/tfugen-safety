@echo off
rem Tapugan Safety - VM notifier. Keeps notify.py running; restarts it if it stops.
cd /d "%~dp0"
:loop
python notify.py
echo notifier stopped - restarting in 30 seconds...
timeout /t 30 /nobreak >nul
goto loop
