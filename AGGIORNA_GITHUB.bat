@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Race Command - Aggiorna GitHub

set "SOURCE=%~dp0"
set "CONFIG=%USERPROFILE%\.race-command-github-repo.txt"
set "WORK=%TEMP%\RaceCommandUpdate_%RANDOM%_%RANDOM%"
set "REPO="

 echo ============================================================
 echo          RACE COMMAND - AGGIORNAMENTO GITHUB
 echo ============================================================
 echo.
 echo Questo programma carica QUESTA build su GitHub.
 echo Se Render e collegato al branch main con Auto-Deploy attivo,
 echo il gioco online verra aggiornato automaticamente dopo il push.
 echo.

rem --- Git ------------------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
  echo [INFO] Git non risulta installato.
  where winget >nul 2>&1
  if errorlevel 1 goto :NO_GIT
  choice /C SN /N /M "Vuoi installare Git automaticamente con winget? [S/N] "
  if errorlevel 2 goto :NO_GIT
  echo.
  echo [INFO] Installazione Git in corso...
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 goto :NO_GIT
  set "PATH=C:\Program Files\Git\cmd;%PATH%"
)
where git >nul 2>&1
if errorlevel 1 goto :NO_GIT

rem --- Repository salvato sul PC -------------------------------
if exist "%CONFIG%" (
  set /p "REPO="<"%CONFIG%"
  if defined REPO (
    echo Repository salvato:
    echo   !REPO!
    echo.
    choice /C SC /N /M "Usare questo repository? [S]i / [C]ambia: "
    if errorlevel 2 set "REPO="
  )
)

:ASK_REPO
if not defined REPO (
  echo.
  set /p "REPO=Incolla il link HTTPS del repository GitHub: "
)
if not defined REPO goto :ASK_REPO
if "!REPO:~-1!"=="/" set "REPO=!REPO:~0,-1!"
echo(!REPO!| findstr /B /I /C:"https://github.com/" >nul
if errorlevel 1 (
  echo.
  echo [ERRORE] Il link deve iniziare con https://github.com/
  set "REPO="
  goto :ASK_REPO
)
if /I not "!REPO:~-4!"==".git" set "REPO=!REPO!.git"
>"%CONFIG%" echo !REPO!

rem --- Clone temporaneo ----------------------------------------
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%" >nul 2>&1

echo.
echo [1/4] Scarico la versione attuale da GitHub...
git clone --depth 1 "!REPO!" "%WORK%\repo"
if errorlevel 1 goto :GIT_AUTH_FAIL

cd /d "%WORK%\repo"
git config user.name "Race Command Updater"
git config user.email "race-command-updater@users.noreply.github.com"

git checkout -B main >nul 2>&1
if errorlevel 1 goto :FAIL

rem Il clone e nuovo, quindi rimuoviamo i file tracciati della build precedente.
rem La cartella .git resta intatta.
git rm -r -f . >nul 2>&1

echo [2/4] Copio Race Command 1.9 nel repository...
rem IMPORTANTE: la copia complessa e in un file .ps1 separato.
rem In questo modo cmd.exe non puo alterare la sintassi PowerShell.
set "RC_SOURCE=%SOURCE%"
set "RC_DESTINATION=%WORK%\repo"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SOURCE%AGGIORNA_GITHUB.ps1"
if errorlevel 1 goto :COPY_FAIL

rem Non caricare mai dipendenze locali / metadata Git della sorgente.
if exist "%WORK%\repo\node_modules" rmdir /s /q "%WORK%\repo\node_modules"

rem Controllo aggiuntivo lato BAT prima del commit.
if not exist "%WORK%\repo\server.js" goto :COPY_FAIL
if not exist "%WORK%\repo\package.json" goto :COPY_FAIL
if not exist "%WORK%\repo\public\index.html" goto :COPY_FAIL

echo [3/4] Creo il commit...
git add -A
if errorlevel 1 goto :FAIL

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Race Command v1.9 - aggiornamento automatico"
  if errorlevel 1 goto :FAIL
) else (
  echo [INFO] GitHub contiene gia gli stessi file: nessun nuovo commit necessario.
)

echo [4/4] Invio su GitHub...
git push -u origin main
if errorlevel 1 goto :GIT_AUTH_FAIL

echo.
echo ============================================================
echo   FATTO: Race Command 1.9 e stato inviato su GitHub.
echo ============================================================
echo.
echo Se Render usa Auto-Deploy ^(On Commit^), il deploy parte da solo.
echo Non devi ricaricare manualmente i file su GitHub.
echo.
cd /d "%SOURCE%"
rmdir /s /q "%WORK%" >nul 2>&1
pause
exit /b 0

:NO_GIT
echo.
echo [ERRORE] Git e necessario per l'aggiornamento automatico.
echo Installa Git for Windows e riapri questo file .bat.
echo https://git-scm.com/download/win
pause
exit /b 1

:GIT_AUTH_FAIL
echo.
echo [ERRORE] GitHub non ha accettato il clone/push.
echo Al primo utilizzo Git Credential Manager puo aprire il browser:
echo completa il login GitHub e poi rilancia AGGIORNA_GITHUB.bat.
echo.
echo Se hai salvato il repository sbagliato, elimina questo file:
echo %CONFIG%
echo oppure rilancia il BAT e scegli C = Cambia.
goto :FAIL_END

:COPY_FAIL
echo.
echo [ERRORE] Non sono riuscito a copiare i file della nuova build.
echo.
echo Percorso sorgente:
echo   %SOURCE%
echo Percorso temporaneo:
echo   %WORK%\repo
echo.
echo Il dettaglio dell'errore PowerShell dovrebbe essere visibile poco sopra.
echo Controlla anche che lo ZIP sia stato ESTRATTO completamente.
goto :FAIL_END

:FAIL
echo.
echo [ERRORE] Aggiornamento Git non completato.

:FAIL_END
cd /d "%SOURCE%"
if exist "%WORK%" rmdir /s /q "%WORK%" >nul 2>&1
pause
exit /b 1
