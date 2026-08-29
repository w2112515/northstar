# G1 smoke: Alpaca clock/account/quote -> journal
$root = Split-Path $PSScriptRoot -Parent
Set-Location "$root\apps\api"
uv run python -m northstar.smoke
