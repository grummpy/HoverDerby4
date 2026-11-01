@echo off
setlocal
cd /d "%~dp0"
echo Hover Derby 4

where py >nul 2>&1
if %errorlevel%==0 (
  echo Starting local server. Close this window to stop.
  py -3 server.py
  goto :done
)

where python3 >nul 2>&1
if %errorlevel%==0 (
  echo Starting local server. Close this window to stop.
  python3 server.py
  goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
  echo Starting local server. Close this window to stop.
  python server.py
  goto :done
)

echo Python 3 is required to launch Hover Derby 4.
echo Install it from https://www.python.org/downloads/ and run this launcher again.
pause
exit /b 1

:done
endlocal
