$ErrorActionPreference='Stop'
$changed=$false
try{
 $private='C:\ProgramData\ActivityTAB';$target='C:\inetpub\wwwroot\CFOProject\ActivityTAB\public'
 $zip=Join-Path $private 'packages\ActivityTAB-Client-update.zip'
 Copy-Item -LiteralPath '\\tsclient\server-transfer\ActivityTAB-Client-update.zip' -Destination $zip -Force
 if((Get-FileHash $zip -Algorithm SHA256).Hash -ne 'fdf62ec1628e072db96efe5f8aaa15fc2af7bd53a25a70868f41956575a6f358'){throw 'Client package checksum failed'}
 $staging=Join-Path $private ('packages\client-'+[guid]::NewGuid().ToString());Expand-Archive -LiteralPath $zip -DestinationPath $staging -Force
 $expected=@{'app.js'='2eb35faa767ad6103e5546fc2d93ca105be769fa86416c1003d38877e99d23f1';'app.css'='3aa54a2d3249c3de629c4d5a5910799b140f94b49e0ed3e9d9b52286edde2509'}
 foreach($name in $expected.Keys){if((Get-FileHash (Join-Path $staging $name) -Algorithm SHA256).Hash -ne $expected[$name]){throw 'Client asset verification failed'}}
 $backup=Join-Path $private ('backups\holiday-range-'+(Get-Date -Format yyyyMMdd-HHmmss));New-Item -ItemType Directory -Force -Path $backup|Out-Null
 foreach($name in $expected.Keys){Copy-Item -LiteralPath (Join-Path $target $name) -Destination (Join-Path $backup $name) -Force}
 $changed=$true
 foreach($name in $expected.Keys){$temp=Join-Path $target ($name+'.update');Copy-Item -LiteralPath (Join-Path $staging $name) -Destination $temp -Force;Move-Item -LiteralPath $temp -Destination (Join-Path $target $name) -Force}
 foreach($name in $expected.Keys){if((Get-FileHash (Join-Path $target $name) -Algorithm SHA256).Hash -ne $expected[$name]){throw 'Published asset verification failed'}}
 $h=Invoke-RestMethod 'http://127.0.0.1:3187/ActivityTAB/health';if(-not $h.ok){throw 'Application health check failed'}
 Write-Host 'CLIENT UPDATE VERIFIED: Holiday ranges and editable reminder fields are live.' -ForegroundColor Green
 Write-Host 'The application stayed running; only browser assets were updated.'
}catch{
 if($changed){foreach($name in $expected.Keys){Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $target $name) -Force}}
 Write-Host ('CLIENT UPDATE STOPPED: '+$_.Exception.Message) -ForegroundColor Red
}
Read-Host 'Press Enter to close'
