@echo off
title Project-AirVia Server
cd /d "%~dp0"

echo ========================================================
echo               Starting Project-AirVia Server
echo ========================================================
echo.
echo Ensuring firewall rule for port 3000...
netsh advfirewall firewall add rule name="AirVia_Port_3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1

echo.
echo Initializing local hotspot and offline web platform...
echo.

node src/server.js

pause
