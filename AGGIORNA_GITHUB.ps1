$ErrorActionPreference = 'Stop'

try {
    $Source = $env:RC_SOURCE
    $Destination = $env:RC_DESTINATION

    if ([string]::IsNullOrWhiteSpace($Source)) {
        throw 'Variabile RC_SOURCE mancante.'
    }
    if ([string]::IsNullOrWhiteSpace($Destination)) {
        throw 'Variabile RC_DESTINATION mancante.'
    }

    $sourcePath = (Resolve-Path -LiteralPath $Source).Path
    $destinationPath = (Resolve-Path -LiteralPath $Destination).Path

    Write-Host "    Sorgente: $sourcePath"
    Write-Host "    Destinazione: $destinationPath"

    $items = Get-ChildItem -LiteralPath $sourcePath -Force | Where-Object {
        $_.Name -ne '.git' -and $_.Name -ne 'node_modules'
    }

    if (-not $items) {
        throw 'La cartella della build non contiene file da copiare.'
    }

    foreach ($item in $items) {
        Copy-Item -LiteralPath $item.FullName -Destination $destinationPath -Recurse -Force
    }

    $requiredFiles = @(
        (Join-Path $destinationPath 'server.js'),
        (Join-Path $destinationPath 'package.json'),
        (Join-Path $destinationPath 'public\index.html')
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "File obbligatorio non copiato: $file"
        }
    }

    Write-Host '    Copia completata e verificata.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('[ERRORE POWERSHELL] ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
