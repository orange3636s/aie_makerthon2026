@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS: https://nodejs.org/
 pause
 exit /b 1
)
set "SIMULATION_PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%SIMULATION_PYTHON%" set "SIMULATION_PYTHON=%~dp0..\..\..\..\ViennaPS-Lab\.venv\Scripts\python.exe"
if not exist "%SIMULATION_PYTHON%" (
 echo Run setup.cmd first.
 pause
 exit /b 1
)
start "" "http://127.0.0.1:3001/"
node server.cjs
pause
