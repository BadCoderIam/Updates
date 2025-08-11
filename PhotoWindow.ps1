# PhotoWindow.ps1 – modular photo updater window (reuses existing auth)

# --- Minimal modules (lightweight) ---
Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
Import-Module Microsoft.Graph.Users          -ErrorAction Stop
Import-Module Microsoft.Graph.Groups         -ErrorAction Stop


function Show-PhotoWindow {
  param([Parameter(Mandatory)][hashtable]$AppState)

  # Config (change as needed, or add UI fields later)
  $GroupName       = "DYN-ActiveUsers"
  $PhotoFilePath   = "C:\Scripts\android-chrome-512x512.png"
  $SnapshotPath    = "C:\Scripts\activeusers_snapshot.json"
  $RecheckDays     = 30     # trust snapshot within this window; 0 = always trust when hash matches

  # --- helpers (local) ---
  function Load-Snapshot {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    try {
      $raw = Get-Content -Path $Path -Raw
      if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
      $json = $raw | ConvertFrom-Json
      if ($json -is [System.Array]) {
        $m = @{}; foreach($upn in $json){ if ($upn){ $m[$upn] = [ordered]@{ lastHash=$null; lastSetUtc=$null; lastVerifiedUtc=$null } } }
        return $m
      }
      $map = @{}; foreach($p in $json.PSObject.Properties){ $map[$p.Name] = $p.Value }; return $map
    } catch { return @{} }
  }
  function Save-Snapshot { param([hashtable]$Map,[string]$Path)
    $obj = [ordered]@{}; foreach($k in $Map.Keys | Sort-Object){ $obj[$k] = $Map[$k] }
    $obj | ConvertTo-Json -Depth 6 | Set-Content -Path $Path -Encoding UTF8
  }

  # --- UI ---
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $f = New-Object Windows.Forms.Form
  $f.Text = "Update Photos – $GroupName"
  $f.StartPosition = 'CenterParent'
  $f.Width = 720; $f.Height = 460
  $f.TopMost = $true

  $lbl = New-Object Windows.Forms.Label
  $lbl.Text = "Photo file: $PhotoFilePath"
  $lbl.Left=15; $lbl.Top=15; $lbl.Width=650
  $f.Controls.Add($lbl)

  $bar = New-Object Windows.Forms.ProgressBar
  $bar.Left=15; $bar.Top=45; $bar.Width=670; $bar.Height=18
  $bar.Minimum=0; $bar.Maximum=100; $bar.Value=0
  $f.Controls.Add($bar)

  $rtb = New-Object Windows.Forms.RichTextBox
  $rtb.Left=15; $rtb.Top=75; $rtb.Width=670; $rtb.Height=300; $rtb.ReadOnly=$true
  $f.Controls.Add($rtb)

  $btnRun = New-Object Windows.Forms.Button
  $btnRun.Text="Run"
  $btnRun.Left=480; $btnRun.Top=385; $btnRun.Width=90
  $f.Controls.Add($btnRun)

  $btnClose = New-Object Windows.Forms.Button
  $btnClose.Text="Back"
  $btnClose.Left=595; $btnClose.Top=385; $btnClose.Width=90
  $f.Controls.Add($btnClose)

  $Cancel = $false
  $btnClose.Add_Click({ $Cancel = $true; $f.Close() })

  function UI([int]$pct,[string]$msg){
    if ($pct -lt 0){$pct=0} elseif ($pct -gt 100){$pct=100}
    $bar.Value = $pct
    if ($msg){ $rtb.AppendText(("{0} {1}`r`n" -f (Get-Date).ToString("HH:mm:ss"), $msg)) }
    [System.Windows.Forms.Application]::DoEvents()
  }

  $btnRun.Add_Click({
    if (-not (Test-Path $PhotoFilePath)) {
      [System.Windows.Forms.MessageBox]::Show("Photo file not found:`n$PhotoFilePath","File missing",0,16) | Out-Null
      return
    }

    # Ensure Graph auth (works standalone or from main menu)
    $ctx = $null
    try { $ctx = Get-MgContext -ErrorAction Stop } catch {}
    if (-not $ctx -or -not $ctx.Account) {
      $f.TopMost = $false
      $f.WindowState = 'Minimized'
      [System.Windows.Forms.Application]::DoEvents()
      try {
        $scopes = @("User.ReadWrite.All","Group.Read.All","GroupMember.Read.All")
        $env = if ($AppState.Environment) { $AppState.Environment } else { "USGov" }
        Connect-MgGraph -Environment $env -Scopes $scopes -NoWelcome | Out-Null
      } catch {
        [System.Windows.Forms.MessageBox]::Show("Authentication cancelled or failed.`n$($_.Exception.Message)","Auth",0,48) | Out-Null
        $f.WindowState = 'Normal'; $f.TopMost = $true
        return
      }
      $f.WindowState = 'Normal'; $f.TopMost = $true
    }

    try {
      $btnRun.Enabled = $false
      UI 2 "Starting…"
      $hash = (Get-FileHash -Path $PhotoFilePath -Algorithm MD5).Hash
      $now  = [DateTime]::UtcNow
      $snap = Load-Snapshot -Path $SnapshotPath

      UI 6 "Locating group '$GroupName'…"
      $g = Get-MgGroup -Filter "DisplayName eq '$GroupName'"
      if (-not $g) { throw "Group not found: $GroupName" }

      UI 10 "Enumerating members…"
      $members = Get-MgGroupMember -GroupId $g.Id -All | Where-Object {
        $_.AdditionalProperties['@odata.type'] -eq '#microsoft.graph.user'
      }
      $upns = @(); foreach($m in $members){ $upns += [string]$m.AdditionalProperties['userPrincipalName'] }
      $upns = $upns | Where-Object { $_ } | Sort-Object -Unique

      $total = [Math]::Max(1,$upns.Count)
      $i=0; $applied=0; $skipped=0; $errors=0

      foreach ($u in $upns) {
        if ($Cancel) { throw "CancelledByUser" }
        $i++; $pct = 10 + [int](($i/$total)*88)
        UI $pct "User $i/$total $u"

        if (-not $snap.ContainsKey($u)) {
          $snap[$u] = [ordered]@{ lastHash=$null; lastSetUtc=$null; lastVerifiedUtc=$null }
        }
        $entry = $snap[$u]
        $trust = $false
        if ($entry.lastHash -eq $hash) {
          if ($RecheckDays -eq 0) { $trust = $true }
          elseif ($entry.lastVerifiedUtc) {
            $trust = (([DateTime]::UtcNow - [datetime]$entry.lastVerifiedUtc).TotalDays -lt $RecheckDays)
          }
        }
        if ($trust) { $rtb.AppendText("  ⏭️  Skipped (snapshot ok)`r`n"); $skipped++; continue }

        try {
          Set-MgUserPhotoContent -UserId $u -InFile $PhotoFilePath
          $entry.lastHash=$hash; $entry.lastSetUtc=$now.ToString("o"); $entry.lastVerifiedUtc=$now.ToString("o")
          $rtb.AppendText("  ✅ Applied`r`n"); $applied++
        } catch {
          $rtb.AppendText(("  ❌ Error: {0}`r`n" -f $_.Exception.Message)); $errors++
        } finally {
          Start-Sleep -Milliseconds 120
        }
        $snap[$u] = $entry
      }

      $cur = [System.Collections.Generic.HashSet[string]]::new([string[]]$upns)
      foreach($k in @($snap.Keys)){ if (-not $cur.Contains($k)) { $snap.Remove($k) } }

      UI 99 "Saving snapshot…"
      Save-Snapshot -Map $snap -Path $SnapshotPath
      UI 100 ("Done. Updated={0} Skipped={1} Errors={2}" -f $applied,$skipped,$errors)
    }
    catch {
      if ($_.Exception.Message -eq "CancelledByUser") {
        UI $bar.Value "Cancelled."
      } else {
        UI $bar.Value ("Stopped: {0}" -f $_.Exception.Message)
      }
    }
    finally {
      $btnRun.Enabled = $true
    }
})

# SHOW THE WINDOW (this must be inside the function)
[void]$f.ShowDialog()
}  # <--- end of function Show-PhotoWindow

# -------- Auto-launch when invoked directly (must be OUTSIDE the function) --------
if ($MyInvocation.InvocationName -ne '.') {
  if ([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    $args = @('-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',"`"$PSCommandPath`"")
    Start-Process powershell -ArgumentList $args | Out-Null
    return
  }
  $state = [ordered]@{ Environment = 'USGov'; IsAuthenticated = $false }
  Show-PhotoWindow -AppState $state
}
