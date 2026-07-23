@echo off
echo ==========================================================
echo       OmniScan AI Local Network Server
echo ==========================================================
echo.
echo To access the application from your iPhone:
echo.
echo 1. Ensure your iPhone is connected to the SAME Wi-Fi network.
echo 2. Open Chrome or Safari on your iPhone and go to:
echo    http://192.168.2.72:8080/
echo    OR
echo    http://192.168.60.201:8080/
echo.
echo NOTE: Since iOS requires HTTPS for camera access over local network IPs,
echo you may need to use the "Upload Image" fallback option in Chrome, or
echo open the index.html file directly from the Files app in iOS Safari.
echo.
echo Starting Python web server on port 8080...
echo Press Ctrl+C to stop the server.
echo.
python -m http.server 8080
