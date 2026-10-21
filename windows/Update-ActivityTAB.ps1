$ErrorActionPreference='Stop'
try{
 $target='C:\inetpub\wwwroot\CFOProject\ActivityTAB';$private='C:\ProgramData\ActivityTAB'
 Write-Host 'Copying tested update...'
 $zip=Join-Path $private 'packages\ActivityTAB-Update.zip';Copy-Item -LiteralPath '\\tsclient\server-transfer\ActivityTAB-Windows-update.zip' -Destination $zip -Force
 if((Get-FileHash $zip -Algorithm SHA256).Hash -ne '8a123f8f9d80e0dc139e6db59c544d1c65d6067dec3fd29d7e438cac7b75b10e'){throw 'Update package checksum failed'}
 $backup=Join-Path $private ('backups\document-download-'+(Get-Date -Format yyyyMMdd-HHmmss));New-Item -ItemType Directory -Force -Path $backup|Out-Null;Copy-Item -LiteralPath $target -Destination $backup -Recurse
 Stop-ScheduledTask -TaskName 'ActivityTAB Server';Start-Sleep -Seconds 1
 Get-CimInstance Win32_Process|Where-Object{$_.Name -eq 'node.exe' -and $_.CommandLine -like '*ActivityTAB*server.mjs*'}|ForEach-Object{Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}
 Expand-Archive -LiteralPath $zip -DestinationPath $target -Force
 Start-ScheduledTask -TaskName 'ActivityTAB Server'
 $h=$null;for($i=0;$i -lt 15;$i++){try{$h=Invoke-RestMethod 'http://127.0.0.1:3187/ActivityTAB/health';if($h.ok){break}}catch{};Start-Sleep -Seconds 1};if(-not $h.ok){throw 'Startup health check failed'}
 Write-Host 'UPDATE VERIFIED: ActivityTAB is running.' -ForegroundColor Green;Write-Host ($h|ConvertTo-Json)
 $task=Get-ScheduledTask -TaskName 'ActivityTAB Server';Write-Host ('Task state: '+$task.State);Write-Host ('Service account: '+$task.Principal.UserId);Write-Host ('Startup triggers: '+$task.Triggers.Count)
}catch{Write-Host ('UPDATE STOPPED: '+$_.Exception.Message) -ForegroundColor Red}
Read-Host 'Press Enter to close'
