#Requires -Version 5.1
<#
  run_sort_takes.ps1 - installs what sort_takes.py needs, then runs pass 1.

  Put this file and sort_takes.py in the same folder, right-click this file
  and choose "Run with PowerShell".

  It does NOT copy or move any footage. It stops after writing takes.csv so
  you can check it first.
#>

$ErrorActionPreference = "Stop"

function Write-Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Fail($m) {
    Write-Host "`nSTOPPED: $m" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "Take sorter - setup and pass 1" -ForegroundColor Green

# --- the python tool must sit next to this script ------------------------
$tool = Join-Path $PSScriptRoot "sort_takes.py"
if (-not (Test-Path $tool)) {
    Fail "sort_takes.py is not in $PSScriptRoot. Put both files in the same folder."
}

# --- python ---------------------------------------------------------------
Write-Step "Checking Python"
$py = $null
foreach ($c in @("python", "py")) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { $py = $c; break }
}
if (-not $py) {
    Fail "Python not found. Install it from https://www.python.org/downloads/ and tick 'Add Python to PATH', then run this again."
}
& $py --version

# --- ffmpeg ---------------------------------------------------------------
Write-Step "Checking ffmpeg"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ffmpeg not found. Installing with winget (this can take a couple of minutes)..."
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Fail "winget is not available. Download ffmpeg from https://www.gyan.dev/ffmpeg/builds/ and add its bin folder to PATH."
    }
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    # winget updates PATH for NEW shells, so pull it in for this one
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User")
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Fail "ffmpeg still is not on PATH. Close this window, open a fresh PowerShell, and run this script again."
}
(ffmpeg -version | Select-Object -First 1)

# --- python packages ------------------------------------------------------
Write-Step "Installing Python packages"
& $py -m pip install --quiet --upgrade pip
& $py -m pip install --quiet faster-whisper rapidfuzz
if ($LASTEXITCODE -ne 0) { Fail "pip install failed - the error is above." }
Write-Host "faster-whisper and rapidfuzz ready."

# --- the shoot folder -----------------------------------------------------
Write-Step "Finding the shoot folder"
$folder = Get-ChildItem -Path (Join-Path $env:USERPROFILE "Downloads") -Directory `
          -Filter "VSL + Ads Shoot HookHouse*" -ErrorAction SilentlyContinue |
          Select-Object -First 1
if (-not $folder) {
    Fail "No folder starting 'VSL + Ads Shoot HookHouse' in your Downloads. Move it there, or edit this script's folder line."
}
$videos = @(Get-ChildItem -Path $folder.FullName -File |
            Where-Object { $_.Extension -match '^\.(mov|mp4|m4v)$' })
if ($videos.Count -eq 0) { Fail "No .mov/.mp4 files in $($folder.FullName)" }
Write-Host "$($folder.FullName)"
Write-Host "$($videos.Count) video file(s)"

# --- the script file ------------------------------------------------------
Write-Step "Finding the script file"
$candidates = @(
    Get-ChildItem -Path $folder.FullName, $PSScriptRoot -File -Filter "*.txt" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*transcripts*" } | Sort-Object Name -Unique
)
if ($candidates.Count -eq 0) {
    Fail "No .txt script file found in the shoot folder or next to this script. Save your labelled script as a .txt there."
}
if ($candidates.Count -eq 1) {
    $scriptFile = $candidates[0]
} else {
    Write-Host "Which file is the script?"
    for ($i = 0; $i -lt $candidates.Count; $i++) {
        Write-Host "  [$($i + 1)] $($candidates[$i].FullName)"
    }
    $pick = Read-Host "Number"
    $idx = 0
    if (-not [int]::TryParse($pick, [ref]$idx) -or $idx -lt 1 -or $idx -gt $candidates.Count) {
        Fail "'$pick' is not one of the listed numbers."
    }
    $scriptFile = $candidates[$idx - 1]
}
Write-Host "$($scriptFile.FullName)"

# --- check the script parses BEFORE the slow part -------------------------
Write-Step "How your script parsed into sections"
& $py $tool --script $scriptFile.FullName --list-sections
if ($LASTEXITCODE -ne 0) { Fail "The script file did not parse. Check the section labels." }

Write-Host ""
$ok = Read-Host "Do those sections look right? (y/n)"
if ($ok -notmatch '^[Yy]') {
    Write-Host "Fix the labels in $($scriptFile.Name) and run this again." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 0
}

# --- pass 1 ---------------------------------------------------------------
$csv = Join-Path $folder.FullName "takes.csv"
Write-Step "Transcribing and matching $($videos.Count) clip(s)"
Write-Host "First run downloads the whisper model (~500 MB). Allow 10-20 min for 100 clips."
& $py $tool --folder $folder.FullName --script $scriptFile.FullName --csv $csv
if ($LASTEXITCODE -ne 0) { Fail "Pass 1 failed - the error is above." }

Write-Step "Done - nothing has been copied yet"
Write-Host "Review this file:  $csv"
Write-Host ""
Write-Host "Then, in PowerShell, from $($folder.FullName):" -ForegroundColor Yellow
Write-Host "  $py `"$tool`" --folder . --script `"$($scriptFile.Name)`" --csv takes.csv --copy"
Write-Host "  $py `"$tool`" --folder . --script `"$($scriptFile.Name)`" --csv takes.csv --copy --yes"

if (Test-Path $csv) { Invoke-Item $csv }
Read-Host "`nPress Enter to close"
