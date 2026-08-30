@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js non risulta installato.
  echo Installa Node.js 22 o piu recente e poi riapri questo file.
  echo https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo.
echo Avvio Race Command Web 1.0 FINAL...
start "Race Command Server" /D "%~dp0" cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
exit /b 0
