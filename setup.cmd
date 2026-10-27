@echo off
cd /d "%~dp0"
py -3.12 -m venv .venv
if errorlevel 1 (
 echo Install Python 3.12 x64: https://www.python.org/downloads/
 pause
 exit /b 1
)
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
 echo Installation failed. Check the error above.
 pause
 exit /b 1
)
.venv\Scripts\python.exe scripts\install-native.py
if errorlevel 1 (
 echo Native runtime installation failed.
 pause
 exit /b 1
)
echo Setup complete. Open start.cmd.
pause
