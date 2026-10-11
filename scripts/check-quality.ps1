param([string]$Python = "python", [switch]$Integration)
$ErrorActionPreference = "Stop"
$TaskRoot = Split-Path $PSScriptRoot -Parent
$TaskNpm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
function Invoke-QualityCommand([string]$Executable, [string[]]$Arguments) {
    # Windows PowerShell treats native stderr as an error when output is redirected.
    # Tool warnings are allowed; the process exit code determines success.
    $TaskPreviousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $Executable @Arguments
        $TaskExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $TaskPreviousPreference }
    if ($TaskExitCode -ne 0) { throw "Quality command failed: $Executable $Arguments" }
}
Push-Location (Join-Path $TaskRoot "backend")
try {
    Invoke-QualityCommand $Python @("-m", "ruff", "check", ".")
    Invoke-QualityCommand $Python @("-m", "ruff", "format", "--check", ".")
    Invoke-QualityCommand $Python @("-m", "pytest", "-m", "unit", "-q")
    if ($Integration) { Invoke-QualityCommand $Python @("-m", "pytest", "-m", "integration", "-q") }
} finally { Pop-Location }
Push-Location (Join-Path $TaskRoot "frontend")
try {
    foreach ($TaskCheck in @("typecheck", "lint", "test:ci", "build")) {
        Invoke-QualityCommand $TaskNpm @("run", $TaskCheck)
    }
} finally { Pop-Location }
