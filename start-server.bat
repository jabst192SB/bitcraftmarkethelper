@echo off
echo Starting Bitcraft Market Helper...
echo.
echo The application will open in your default browser.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop the server when done.
echo.

REM Try Python 3 first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Starting web server with Python...
    echo Open your browser to: http://localhost:8000
    echo.
    start http://localhost:8000
    python -m http.server 8000
    goto :eof
)

REM Try Python 2
python -m SimpleHTTPServer 8000 >nul 2>&1
if %errorlevel% == 0 (
    echo Starting web server with Python 2...
    echo Open your browser to: http://localhost:8000
    echo.
    start http://localhost:8000
    python -m SimpleHTTPServer 8000
    goto :eof
)

REM Try Node.js with npx http-server
npx --version >nul 2>&1
if %errorlevel% == 0 (
    echo Starting web server with Node.js...
    echo Open your browser to: http://localhost:8080
    echo.
    start http://localhost:8080
    npx http-server -p 8080
    goto :eof
)

echo ERROR: Could not find Python or Node.js installed.
echo.
echo Please install one of the following:
echo   1. Python - Download from: https://www.python.org/downloads/
echo   2. Node.js - Download from: https://nodejs.org/
echo.
echo Then run this file again.
echo.
pause
