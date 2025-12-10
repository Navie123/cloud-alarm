@echo off
REM Cloud Fire Alarm - ESP32 Upload Script
REM Usage: upload.bat [port]

set PORT=%1
if "%PORT%"=="" set PORT=COM9

set CLI="C:\Program Files\Arduino CLI\arduino-cli.exe"

echo.
echo === Cloud Fire Alarm - Upload ===
echo Port: %PORT%
echo.

REM First, we need to install the Firebase library
echo [1/4] Installing Firebase ESP Client library...
%CLI% lib install "Firebase ESP Client"
if errorlevel 1 (
    echo Warning: Library install had issues, continuing anyway...
)

echo.
echo [2/4] Compiling sketch...
%CLI% compile --fqbn esp32:esp32:esp32 --library "..\..\ClosedCube_HDC1080-1.3.2" cloud_alarm
if errorlevel 1 (
    echo Compile failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Uploading sketch to %PORT%...
%CLI% upload -p %PORT% --fqbn esp32:esp32:esp32 cloud_alarm
if errorlevel 1 (
    echo Upload failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Upload Complete!
echo Opening serial monitor... (Ctrl+C to exit)
echo.
%CLI% monitor -p %PORT% -c baudrate=115200

pause
