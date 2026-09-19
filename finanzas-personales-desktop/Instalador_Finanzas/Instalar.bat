@echo off
title Instalador - Control de Finanzas Personales
chcp 65001 > nul
cls
echo =======================================================
echo   Instalador de Control de Finanzas Personales
echo =======================================================
echo.
echo [-] Instalando la aplicación en tu equipo...

set "TARGET_DIR=%LOCALAPPDATA%\ControlFinanzas"
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

copy /Y "%~dp0bot-gastos.exe" "%TARGET_DIR%\bot-gastos.exe" > nul

echo [-] Creando acceso directo en el Escritorio...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Control de Finanzas.lnk"
set "TARGET_EXE=%TARGET_DIR%\bot-gastos.exe"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%TARGET_DIR%'; $s.Save()"

echo.
echo =======================================================
echo   ¡Instalación completada con éxito!
echo   Se ha creado el acceso directo 'Control de Finanzas'
echo   en tu Escritorio.
echo =======================================================
echo.
echo Abriendo la aplicación por primera vez...
timeout /t 2 > nul
start "" "%TARGET_EXE%"
