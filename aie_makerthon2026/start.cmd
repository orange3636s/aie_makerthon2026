@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS: https://nodejs.org/
 pause
 exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
 echo Run setup.cmd first.
 pause
 exit /b 1
)
set "SIMULATION_PYTHON=%~dp0.venv\Scripts\python.exe"
start "" "http://127.0.0.1:3001/challenge"
node server.cjs
pause
