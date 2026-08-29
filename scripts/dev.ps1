# NorthStar dev entry - starts API (uv/uvicorn :8000) and Web (next :3000) in two windows.
$root = Split-Path $PSScriptRoot -Parent
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\api'; uv run uvicorn northstar.api.app:app --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\web'; npm run dev"
Write-Host "API  -> http://localhost:8000/healthz"
Write-Host "Web  -> http://localhost:3000"
