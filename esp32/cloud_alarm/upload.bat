@echo off
REM Cloud Fire Alarm - ESP32 Upload Script
REM Usage: upload.bat [port]

set PORT=%1
if "%PORT%"=="" set PORT=COM9

set CLI="C:\Program Files\Arduino CLI\arduino-cli.exe"

echo.
echo === Cloud Fire Alarm - Upload to ESP32 ===
echo Port: %PORT%
echo.

echo [1/4] Installing Firebase ESP Client library...
%CLI% lib install "Firebase Arduino Client Library for ESP8266 and ESP32"

echo.
echo [2/4] Compiling sketch...
%CLI% compile --fqbn esp32:esp32:esp32 --library "..\..\..\ClosedCube_HDC1080-1.3.2" .
if errorlevel 1 (
    echo Compile failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Uploading sketch to %PORT%...
%CLI% upload -p %PORT% --fqbn esp32:esp32:esp32 .
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
