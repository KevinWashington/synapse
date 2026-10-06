$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backupScript = Join-Path $repositoryRoot "scripts\backup-data.ps1"
$verifyScript = Join-Path $repositoryRoot "scripts\verify-backup.ps1"

function Invoke-ScriptProcess {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & powershell.exe -NoProfile @Arguments 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
        return @{
            ExitCode = $exitCode
            Output = $output
        }
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
}

function Assert-Rejected {
    param(
        [Parameter(Mandatory)][hashtable]$Result,
        [Parameter(Mandatory)][string]$MessagePattern
    )

    if ($Result.ExitCode -eq 0) {
        throw "Expected unsafe input to be rejected, but command exited successfully."
    }
    if ($Result.Output -notmatch $MessagePattern) {
        throw "Expected output matching '$MessagePattern', got: $($Result.Output)"
    }
}

$relativeOutput = Invoke-ScriptProcess -Arguments @(
    "-File", $backupScript,
    "-OutputDirectory", ".",
    "-PostgresContainer", "synapse-postgres",
    "-ValidateOnly"
)
Assert-Rejected -Result $relativeOutput -MessagePattern "absolute dedicated directory"

$repositoryOutput = Invoke-ScriptProcess -Arguments @(
    "-File", $backupScript,
    "-OutputDirectory", $repositoryRoot,
    "-PostgresContainer", "synapse-postgres",
    "-ValidateOnly"
)
Assert-Rejected -Result $repositoryOutput -MessagePattern "repository root"

$productionRestore = Invoke-ScriptProcess -Arguments @(
    "-File", $verifyScript,
    "-BackupFile", (Join-Path $repositoryRoot "missing.dump"),
    "-TemporaryDatabase", "synapse"
)
Assert-Rejected -Result $productionRestore -MessagePattern "production database"

Write-Host "Backup safety tests passed."
