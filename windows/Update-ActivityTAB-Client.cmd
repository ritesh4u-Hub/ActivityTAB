@echo off
powershell.exe -NoProfile -Command "& ([scriptblock]::Create([IO.File]::ReadAllText('\\tsclient\server-transfer\Update-ActivityTAB-Client.ps1')))"
