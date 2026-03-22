@echo off
REM Build EzflplnBridge.dll with MSVC (x64 Developer Command Prompt) or MinGW.
cd /d "%~dp0"
where gcc >nul 2>nul && gcc -shared -O2 -o ..\EzflplnBridge.dll src\EzflplnBridge.c && echo OK: ..\EzflplnBridge.dll && exit /b 0
echo Install MinGW-w64 or use MSVC. See native\README.md
exit /b 1
