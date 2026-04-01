$src = 'C:\Users\Jamie Stone\CortexOS\ascension\node_modules\app-builder-bin'
$targets = @(
    'C:\Users\Jamie Stone\CortexOS\ascension\node_modules\electron-builder\node_modules\app-builder-bin',
    'C:\Users\Jamie Stone\CortexOS\ascension\node_modules\builder-util\node_modules\app-builder-bin',
    'C:\Users\Jamie Stone\CortexOS\ascension\node_modules\app-builder-lib\node_modules\app-builder-bin'
)
foreach ($t in $targets) {
    $parent = Split-Path $t -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    if (-not (Test-Path $t)) {
        New-Item -ItemType Junction -Path $t -Target $src | Out-Null
        Write-Host "Linked: $t"
    } else {
        Write-Host "Already exists: $t"
    }
}
Write-Host "Done"
