$ErrorActionPreference='Stop'
$packageRoot='\\tsclient\server-transfer'
$target='C:\inetpub\wwwroot\CFOProject\ActivityTAB'
$private='C:\ProgramData\ActivityTAB'
$runtime=Join-Path $private 'runtime'
$data=Join-Path $private 'data'
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
try {
 Write-Host 'Checking IIS prerequisites...'; Import-Module WebAdministration
 if (-not (Test-Path IIS:\Sites\CFO)) { throw 'IIS site CFO was not found. No site changes made.' }
 $proxy=Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name enabled
 if (-not $proxy.Value) { throw 'IIS ARR proxy is disabled. Deployment stopped without changing this global setting.' }
 if (-not (Get-WebGlobalModule | Where-Object Name -eq 'RewriteModule')) { throw 'IIS URL Rewrite is required.' }
 Write-Host 'Preparing private runtime and data directories...'; New-Item -ItemType Directory -Force -Path $private,$runtime,$data | Out-Null
 & icacls.exe $private /inheritance:r /grant:r 'BUILTIN\Administrators:(OI)(CI)F' 'NT AUTHORITY\SYSTEM:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)RX' | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'Private directory access could not be restricted.' }
 & icacls.exe $data /grant:r 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)M' | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'Application data access could not be configured.' }
 Write-Host 'Verifying Node archive...'; $packages=Join-Path $private 'packages';New-Item -ItemType Directory -Force -Path $packages | Out-Null
 $archive=Join-Path $packages 'node-v24.22.1-win-x64.zip'
 if(-not (Test-Path $archive)){Write-Host 'Downloading Node from nodejs.org...';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/v24.22.1/node-v24.22.1-win-x64.zip' -OutFile $archive}

 if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne 'D2046D28C2C3DCD211AC5145C0BF30E2047EF9DFB306693C8C6E2ECCD8B95FA5') { throw 'Node archive checksum does not match the official release.' }
 $node=Join-Path $runtime 'node-v24.22.1-win-x64\node.exe'
 if (-not (Test-Path $node)) {Write-Host 'Extracting Node runtime...';Add-Type -AssemblyName System.IO.Compression.FileSystem;New-Item -ItemType Directory -Force -Path (Split-Path $node) | Out-Null;$zip=[System.IO.Compression.ZipFile]::OpenRead($archive);try{$entry=$zip.GetEntry('node-v24.22.1-win-x64/node.exe');if(-not $entry){throw 'Node executable missing from archive'};[System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$node,$true)}finally{$zip.Dispose()}}

 Write-Host 'Backing up application files...'; if (Test-Path $target) { $backup=Join-Path $private ('backups\'+$stamp);New-Item -ItemType Directory -Force -Path $backup | Out-Null;Copy-Item -LiteralPath $target -Destination $backup -Recurse -Force }
 $task=Get-ScheduledTask -TaskName 'ActivityTAB Server' -ErrorAction SilentlyContinue
 if ($task) { Stop-ScheduledTask -TaskName 'ActivityTAB Server';Start-Sleep -Seconds 3 }
 $owned=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*ActivityTAB*server.mjs*' }
 foreach($process in $owned){ Stop-Process -Id $process.ProcessId -ErrorAction SilentlyContinue }
 Write-Host 'Installing ActivityTAB files...'; $appPackage=Join-Path $packages 'ActivityTAB-Windows.zip';Copy-Item -LiteralPath (Join-Path $packageRoot 'ActivityTAB-Windows.zip') -Destination $appPackage -Force;Expand-Archive -LiteralPath $appPackage -DestinationPath $target -Force
 if (-not (Test-Path IIS:\AppPools\ActivityTAB)) { New-WebAppPool -Name ActivityTAB | Out-Null }
 Set-ItemProperty IIS:\AppPools\ActivityTAB -Name managedRuntimeVersion -Value ''
 if (-not (Get-WebApplication -Site CFO -Name ActivityTAB)) { New-WebApplication -Site CFO -Name ActivityTAB -PhysicalPath $target -ApplicationPool ActivityTAB | Out-Null }
 & icacls.exe $target /grant:r 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)RX' 'IIS AppPool\ActivityTAB:(OI)(CI)RX' | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'Runtime read permissions could not be configured.' }
 $runner=Join-Path $private 'Run-ActivityTAB.cmd'
 @"
@echo off
set ACTIVITYTAB_DATA=$data
set ACTIVITYTAB_ORIGIN=https://mis-sweetdreams.in
set PORT=3187
cd /d "$target"
:again
"$node" "$target\server.mjs" >> "$data\server.log" 2>&1
timeout /t 5 /nobreak >nul
goto again
"@ | Set-Content -LiteralPath $runner -Encoding ASCII
 $action=New-ScheduledTaskAction -Execute 'C:\Windows\System32\cmd.exe' -Argument ('/c ""'+$runner+'""')
 $trigger=New-ScheduledTaskTrigger -AtStartup
 $principal=New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName 'ActivityTAB Server' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'ActivityTAB web application and minute-by-minute recurring tasks and mobile reminders.' -Force | Out-Null
 Write-Host 'Starting ActivityTAB...'; Start-ScheduledTask -TaskName 'ActivityTAB Server'
 $health=$null
 for($i=0;$i -lt 20;$i++){try{$health=Invoke-RestMethod 'http://127.0.0.1:3187/ActivityTAB/health';if($health.ok){break}}catch{};Start-Sleep -Seconds 1}
 if(-not $health.ok){throw 'The application did not start. Review C:\ProgramData\ActivityTAB\data\server.log.'}
 Write-Host 'ActivityTAB is running. URL: https://mis-sweetdreams.in/ActivityTAB/' -ForegroundColor Green
 Write-Host ('Unattended reminder tick: '+$health.lastTick)
 $setup=Join-Path $data 'first-admin-setup.txt'
 if(Test-Path $setup){$code=(Get-Content -LiteralPath $setup -Raw).Trim();Start-Process ('https://mis-sweetdreams.in/ActivityTAB/setup?code='+$code)}
 Write-Host 'Create the administrator account in the browser if setup is still pending.'
} catch {Write-Host ('DEPLOYMENT STOPPED: '+$_.Exception.Message) -ForegroundColor Red}
Read-Host 'Press Enter to close'
