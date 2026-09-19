@echo off
chcp 65001 > nul
echo ===================================================
echo   Instalando Control de Finanzas Personales...
echo ===================================================
echo.

set "TARGET_DIR=%LOCALAPPDATA%\ControlFinanzas"
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

echo [-] Copiando archivos del sistema...
copy /Y "%~dp0bot-gastos.exe" "%TARGET_DIR%\bot-gastos.exe" > nul

echo [-] Creando acceso directo en el Escritorio...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Control de Finanzas.lnk"
set "TARGET_EXE=%TARGET_DIR%\bot-gastos.exe"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%TARGET_DIR%'; $s.Save()"

echo.
echo ===================================================
echo   ¡Instalación Completada con Éxito!
echo   Se creó el acceso directo 'Control de Finanzas'
echo   en tu Escritorio.
echo ===================================================
echo.
echo Iniciando aplicación...
timeout /t 2 > nul
start "" "%TARGET_EXE%"
