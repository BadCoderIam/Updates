# OnboardingWatcher.ps1
# Runs your new-hire photo job every Monday at 08:00 Eastern (handles DST)

# ---------------------------
# Config (edit these)
# ---------------------------
$GroupName      = "DYN-ActiveUsers"
$PhotoFilePath  = "C:\Scripts\android-chrome-512x512.png"
$SnapshotPath   = "C:\Scripts\activeusers_snapshot.json"
$LogPath        = "C:\Scripts\onboarding_watcher.log"
$GraphEnvironment = "USGov"   

# ---------------------------
# Logging helper
# ---------------------------
function Log([string]$msg) {
    $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$stamp] $msg"
    $line | Tee-Object -FilePath $LogPath -Append
}

# ---------------------------
# Graph helpers
# ---------------------------
function Ensure-Graph {
    try {
        Get-MgContext | Out-Null
    } catch {
        Log "Connecting to Graph ($GraphEnvironment)..."
        Connect-MgGraph -Environment $GraphEnvironment -Scopes "User.ReadWrite.All","GroupMember.Read.All","Group.Read.All"
    }
}

function Run-SetPhotoForNewGroupMembers {
    $sb = New-Object System.Text.StringBuilder

    if (!(Test-Path $PhotoFilePath)) {
        [void]$sb.AppendLine(" Photo file not found: $PhotoFilePath")
        return $sb.ToString()
    }
    Ensure-Graph

    $group = Get-MgGroup -Filter "DisplayName eq '$GroupName'"
    if (-not $group) {
        [void]$sb.AppendLine(" Group '$GroupName' not found.")
        return $sb.ToString()
    }

    # Load previous snapshot (if any)
    $prevMembers = @()
    if (Test-Path $SnapshotPath) {
        try { $prevMembers = Get-Content $SnapshotPath | ConvertFrom-Json } catch { $prevMembers = @() }
    }

    # Current members (users only)
    $currentMembers = Get-MgGroupMember -GroupId $group.Id -All | Where-Object {
        $_.AdditionalProperties['@odata.type'] -eq '#microsoft.graph.user'
    }

    # Find new users by UPN
    $newUsers = @()
    foreach ($m in $currentMembers) {
        $upn = $m.AdditionalProperties['userPrincipalName']
        if ($prevMembers -notcontains $upn) { $newUsers += $upn }
    }

    if ($newUsers.Count -eq 0) {
        [void]$sb.AppendLine("⏱️ No new users found in '$GroupName'. Nothing to do.")
    } else {
        foreach ($upn in $newUsers) {
            try {
                Set-MgUserPhotoContent -UserId $upn -InFile $PhotoFilePath
                [void]$sb.AppendLine(" Set photo for new user: $upn")
            } catch {
                [void]$sb.AppendLine(" Failed to set photo for $upn $($_.Exception.Message)")
            }
        }
    }

    # Save snapshot
    $currentUPNs = $currentMembers | ForEach-Object { $_.AdditionalProperties['userPrincipalName'] }
    try {
        $currentUPNs | ConvertTo-Json | Set-Content -Path $SnapshotPath -Encoding UTF8
        [void]$sb.AppendLine(" Snapshot updated: $SnapshotPath")
    } catch {
        [void]$sb.AppendLine(" Failed to write snapshot: $($_.Exception.Message)")
    }

    return $sb.ToString()
}

# ---------------------------
# Time helpers (Eastern, with DST) - FIXED
# ---------------------------
$tzEastern = [System.TimeZoneInfo]::FindSystemTimeZoneById("Eastern Standard Time")

function Get-NextMonday0800Eastern {
    # Get "now" in Eastern, from UTC to avoid Kind issues
    $nowUtc     = [DateTime]::UtcNow
    $nowEastern = [System.TimeZoneInfo]::ConvertTimeFromUtc($nowUtc, $tzEastern)  # Kind: Unspecified

    # Build today's 08:00 in Eastern and force Kind = Unspecified
    $candidateEt = [datetime]::new($nowEastern.Year, $nowEastern.Month, $nowEastern.Day, 8, 0, 0)
    $candidateEt = [datetime]::SpecifyKind($candidateEt, [System.DateTimeKind]::Unspecified)

    # If already past today's 08:00 ET, move to the next day (still in ET, Unspecified)
    if ($nowEastern -ge $candidateEt) {
        $candidateEt = $candidateEt.AddDays(1)
    }

    # Walk forward until Monday (still ET, Unspecified)
    while ($candidateEt.DayOfWeek -ne [System.DayOfWeek]::Monday) {
        $candidateEt = $candidateEt.AddDays(1)
    }

    # Convert that ET time to LOCAL clock time for accurate sleeping
    return [System.TimeZoneInfo]::ConvertTime($candidateEt, $tzEastern, [System.TimeZoneInfo]::Local)
}

function Sleep-Until([datetime]$targetLocal) {
    while ($true) {
        $now = Get-Date  # local
        if ($now -ge $targetLocal) { break }
        $remaining = [int][Math]::Ceiling(($targetLocal - $now).TotalSeconds)
        Start-Sleep -Seconds ([Math]::Min($remaining, 3600))  # sleep in chunks
    }
}

# ---------------------------
# Main loop (weekly at Monday 08:00 ET)
# ---------------------------
Log "Watcher starting. Will run every Monday at 08:00 Eastern."
while ($true) {
    try {
        $nextRunLocal = Get-NextMonday0800Eastern
        Log "Next run scheduled for $($nextRunLocal.ToString('yyyy-MM-dd HH:mm:ss')) local time."
        Sleep-Until $nextRunLocal

        Log "Starting photo job..."
        $result = Run-SetPhotoForNewGroupMembers
        $result -split "`n" | ForEach-Object { Log $_ }
        Log "Photo job complete."

        # Schedule next
        $nextRunLocal = Get-NextMonday0800Eastern
        Log "Next run scheduled for $($nextRunLocal.ToString('yyyy-MM-dd HH:mm:ss')) local time."
    } catch {
        Log "Unhandled error in watcher loop: $($_.Exception.Message)"
        # brief backoff to avoid tight crash loops
        Start-Sleep -Seconds 30
    }
}
