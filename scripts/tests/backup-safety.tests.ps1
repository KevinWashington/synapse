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

$verifySource = Get-Content -Raw -LiteralPath $verifyScript

if ($verifySource -notmatch 'CREATE OR REPLACE FUNCTION pg_temp\.safe_count') {
    throw "Pre-migration restore verification must tolerate collaboration tables that do not exist yet."
}
if ($verifySource -notmatch "to_regclass\('public\.' \|\| table_name\)") {
    throw "Optional collaboration table checks must resolve tables without referencing missing relations."
}

$collaborationTables = @(
    "project_members",
    "project_invitations",
    "review_assignments",
    "review_decisions",
    "review_conflicts",
    "project_notifications",
    "project_audit_events"
)
foreach ($table in $collaborationTables) {
    if ($verifySource -notmatch "'$table'.+SELECT count\(\*\) FROM $table") {
        throw "Restore report must include a row count for $table."
    }
}

$collaborationOrphanChecks = @(
    "projectMembersWithoutProject",
    "projectMembersWithoutUser",
    "projectMembersWithoutInviter",
    "projectInvitationsWithoutProject",
    "projectInvitationsWithoutInviter",
    "reviewAssignmentsWithoutProject",
    "reviewAssignmentsWithoutArticle",
    "reviewAssignmentsWithoutReviewer",
    "reviewAssignmentsWithoutAssigner",
    "reviewAssignmentsWithoutInheritedAssignment",
    "reviewDecisionsWithoutAssignment",
    "reviewDecisionsWithoutProject",
    "reviewDecisionsWithoutArticle",
    "reviewDecisionsWithoutReviewer",
    "reviewConflictsWithoutProject",
    "reviewConflictsWithoutArticle",
    "reviewConflictsWithoutResolver",
    "reviewConflictsWithInvalidDecisionIds",
    "projectNotificationsWithoutProject",
    "projectNotificationsWithoutRecipient",
    "projectAuditEventsWithoutProject",
    "projectAuditEventsWithoutActor"
)
foreach ($check in $collaborationOrphanChecks) {
    if ($verifySource -notmatch "'$check'") {
        throw "Restore verification must include orphan check $check."
    }
}

if ($verifySource -notmatch 'orphanCounts = \$orphans') {
    throw "Restore report must keep orphan counts machine-readable."
}
if ($verifySource -notmatch '\$nonZeroOrphans') {
    throw "Restore verification must fail generically for every non-zero orphan count."
}

Write-Host "Backup safety tests passed."
