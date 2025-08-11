# Intune Audit (USGov) – Export + Import (Settings Catalog) GUI
# - One interactive auth to USGov; SSO prompt is brought to front
# - Export selected sections to one workbook per section
# - Import "Settings Catalog" changes from edited workbook (Dry-run or Apply)
# - Lazy-load beta submodules to avoid function overflow
# - Bootstrap PowerShellGet/NuGet so Install-Module works

# ===========================
# Early guard: avoid bloated sessions
# ===========================
try {
  $fCount = (Get-ChildItem function:\ | Measure-Object).Count
  if ($fCount -ge 3500) {
    Write-Host "This session already has $fCount functions. Start a fresh shell with -NoProfile."
    exit 1
  }
} catch {}

# ===========================
# Bootstrap PowerShellGet/NuGet so Install-Module works
# ===========================
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Ensure-PSGallery {
  $repo = Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue
  if (-not $repo) {
    Register-PSRepository -Default
    $repo = Get-PSRepository -Name PSGallery
  }
  if ($repo.InstallationPolicy -ne 'Trusted') {
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
  }
}
function Ensure-NuGetProvider {
  $nuget = Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue
  if (-not $nuget) {
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
  }
}
function Ensure-PowerShellGet {
  $loaded = $false
  try { Import-Module PowerShellGet -MinimumVersion 2.2.5 -ErrorAction Stop; $loaded = $true } catch { $loaded = $false }
  if (-not $loaded) {
    Ensure-PSGallery
    Ensure-NuGetProvider
    Install-Module PowerShellGet -MinimumVersion 2.2.5 -Scope CurrentUser -Force -AllowClobber
    Import-Module PowerShellGet -MinimumVersion 2.2.5 -ErrorAction Stop
  }
}
Ensure-PSGallery
Ensure-NuGetProvider
Ensure-PowerShellGet

# ===========================
# Auto-install + module setup
# ===========================
function Ensure-Module {
  param([Parameter(Mandatory)] [string] $Name, [switch] $Quiet)
  if (-not (Get-Module -ListAvailable -Name $Name)) {
    if (-not $Quiet) { Write-Host "📦 Installing missing module: $Name ..." }
    Install-Module $Name -Scope CurrentUser -Force -AllowClobber
    if (-not $Quiet) { Write-Host "✅ Installed: $name" }
  }
  if (-not (Get-Module -Name $Name)) { Import-Module $Name -ErrorAction Stop }
}

# Core/lightweight modules up front
foreach ($m in @(
  'ImportExcel',
  'Microsoft.Graph.Users',
  'Microsoft.Graph.Authentication',
  'Microsoft.Graph.DeviceManagement',
  'Microsoft.Graph.Groups'
)) { Ensure-Module $m -Quiet }

# Map sections to small beta submodules (lazy-loaded)
$Global:BetaModuleMap = @{
  'Settings Catalog'     = @('Microsoft.Graph.Beta.DeviceManagement.Configuration')
  'Endpoint Security'    = @('Microsoft.Graph.Beta.DeviceManagement.Intents')
  'Scripts/Remediations' = @('Microsoft.Graph.Beta.DeviceManagement.DeviceHealthScripts')
  'Windows Update'       = @('Microsoft.Graph.Beta.DeviceManagement.WindowsUpdates')
  'Autopilot'            = @('Microsoft.Graph.Beta.DeviceManagement.WindowsAutopilot')
  'Filters/Scope Tags'   = @('Microsoft.Graph.Beta.DeviceManagement.AssignmentFilters')
}
function Ensure-BetaModulesForSection { param([string]$SectionName)
  if ($Global:BetaModuleMap.ContainsKey($SectionName)) {
    foreach ($mod in $Global:BetaModuleMap[$SectionName]) { Ensure-Module $mod -Quiet }
  }
}

# ===========================
# Config
# ===========================
# --- Photo job config ---
$Photo_GroupName     = "DYN-ActiveUsers"
$Photo_FilePath      = "C:\Scripts\android-chrome-512x512.png"
$Photo_SnapshotPath  = "C:\Scripts\activeusers_snapshot.json"
$Photo_RecheckDays   = 30    # days to trust snapshot before reapplying (0 = always trust)
$OutDir = "C:\IntuneExports"
$UseCatalogDefinitions = $true   # Include friendly names + Description for Settings Catalog

# ===========================
# Helpers
# ===========================
function Ensure-Dir($p){ if (-not (Test-Path $p)) { New-Item -Path $p -ItemType Directory -Force | Out-Null } }

function Normalize-Value([object]$v){
  $enabled = $null; $text = ""
  if ($null -eq $v) { }
  elseif ($v -is [bool]) { $enabled = $v; $text = $v.ToString() }
  elseif ($v -is [string]) { if ($v -match '^(true|false)$') { $enabled = [bool]::Parse($v) }; $text = $v }
  elseif ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) { $text = ($v | ForEach-Object ToString) -join "; " }
  else { try { $text = ($v | ConvertTo-Json -Compress -Depth 6) } catch { $text = $v.ToString() } }
  [pscustomobject]@{ Text = $text; Enabled = $enabled }
}

function Resolve-AssignmentTarget { param($Target)
  $t = $Target.OdataType
  switch -Regex ($t) {
    'allDevices' { 'All Devices' }
    'allLicensedUsers|allUsers' { 'All Users' }
    'groupAssignmentTarget' {
      $gid = $Target.GroupId
      try { (Get-MgGroup -GroupId $gid -ErrorAction Stop).DisplayName } catch { "Group:$gid" }
    }
    default { $t }
  }
}

function Write-Sheet {
  param([Parameter(Mandatory)]$Data,[Parameter(Mandatory)][string]$WorkbookPath,[Parameter(Mandatory)][string]$WorksheetName)
  $name = $WorksheetName -replace '[:\\/?*\[\]]',''
  if ($name.Length -gt 31) { $name = $name.Substring(0,31) }
  $append = (Test-Path $WorkbookPath)
  $Data | Export-Excel -Path $WorkbookPath -WorksheetName $name -AutoSize -FreezeTopRow -BoldTopRow -AutoFilter -Append:$append
}

# ===========================
# GUI
# ===========================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:CancelRequested = $false

$form = New-Object Windows.Forms.Form
$form.Text = "Intune Audit (USGov) – Export & Import"
$form.StartPosition = 'CenterScreen'
$form.Width = 900; $form.Height = 680
$form.TopMost = $true

# Section selector group
$grp = New-Object Windows.Forms.GroupBox
$grp.Text = "Sections to Export"
$grp.Left = 15; $grp.Top = 10; $grp.Width = 850; $grp.Height = 220
$form.Controls.Add($grp)

# Checkboxes (wrapped; escape & with &&)
$chkSC   = New-Object Windows.Forms.CheckBox; $chkSC.Text   = "Settings Catalog (per-policy sheets + Assignments)"; $chkSC.Checked = $true
$chkLEG  = New-Object Windows.Forms.CheckBox; $chkLEG.Text  = "Legacy Device Configuration (per-profile sheets + Assignments)"; $chkLEG.Checked = $true
$chkCOMP = New-Object Windows.Forms.CheckBox; $chkCOMP.Text = "Compliance Policies"; $chkCOMP.Checked = $true
$chkWU   = New-Object Windows.Forms.CheckBox; $chkWU.Text   = "Windows Update (WUFB Rings / Feature / Quality / Driver)"; $chkWU.Checked = $true
$chkES   = New-Object Windows.Forms.CheckBox; $chkES.Text   = "Endpoint Security (Intents)"; $chkES.Checked = $true
$chkSR   = New-Object Windows.Forms.CheckBox; $chkSR.Text   = "Scripts && Proactive Remediations"; $chkSR.Checked = $true
$chkAP   = New-Object Windows.Forms.CheckBox; $chkAP.Text   = "Autopilot (Profiles && Devices)"; $chkAP.Checked = $true
$chkENR  = New-Object Windows.Forms.CheckBox; $chkENR.Text  = "Enrollment Configurations"; $chkENR.Checked = $true
$chkFLT  = New-Object Windows.Forms.CheckBox; $chkFLT.Text  = "Assignment Filters && Scope Tags"; $chkFLT.Checked = $true
$chkRBAC = New-Object Windows.Forms.CheckBox; $chkRBAC.Text = "RBAC (Role Definitions && Assignments)"; $chkRBAC.Checked = $true
$chkAPPS = New-Object Windows.Forms.CheckBox; $chkAPPS.Text = "Apps && App Assignments"; $chkAPPS.Checked = $true

$checks = @($chkSC,$chkLEG,$chkCOMP,$chkWU,$chkES,$chkSR,$chkAP,$chkENR,$chkFLT,$chkRBAC,$chkAPPS)
for ($i=0; $i -lt $checks.Count; $i++) {
  $cb = $checks[$i]
  $col = [math]::Floor($i/6)  # two columns
  $row = $i % 6
  $cb.Left = 15 + ($col * 410)
  $cb.Top  = 30 + ($row * 30)
  $cb.AutoSize = $true
  $cb.MaximumSize = New-Object Drawing.Size(390, 0)   # wrap at ~390px
  $cb.UseCompatibleTextRendering = $true
  $grp.Controls.Add($cb)
}

# Options group
$grpOpt = New-Object Windows.Forms.GroupBox
$grpOpt.Text = "Options"
$grpOpt.Left = 15; $grpOpt.Top = 240; $grpOpt.Width = 850; $grpOpt.Height = 70
$form.Controls.Add($grpOpt)

$lblOut = New-Object Windows.Forms.Label
$lblOut.Text = "Output folder:"
$lblOut.Left = 15; $lblOut.Top = 30; $lblOut.AutoSize = $true
$grpOpt.Controls.Add($lblOut)

$txtOut = New-Object Windows.Forms.TextBox
$txtOut.Left = 110; $txtOut.Top = 26; $txtOut.Width = 600
$txtOut.Text = $OutDir
$grpOpt.Controls.Add($txtOut)

$btnBrowse = New-Object Windows.Forms.Button
$btnBrowse.Text = "Browse…"
$btnBrowse.Left = 720; $btnBrowse.Top = 24
$btnBrowse.Add_Click({
  $fbd = New-Object System.Windows.Forms.FolderBrowserDialog
  if ($fbd.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $txtOut.Text = $fbd.SelectedPath }
})
$grpOpt.Controls.Add($btnBrowse)

# Progress group
$grpProg = New-Object Windows.Forms.GroupBox
$grpProg.Text = "Progress"
$grpProg.Left = 15; $grpProg.Top = 320; $grpProg.Width = 850; $grpProg.Height = 260
$form.Controls.Add($grpProg)

$lblStatus = New-Object Windows.Forms.Label
$lblStatus.Text = "Status:"
$lblStatus.Left = 15; $lblStatus.Top = 25; $lblStatus.AutoSize = $true
$grpProg.Controls.Add($lblStatus)

$lblPhase = New-Object Windows.Forms.Label
$lblPhase.Text = "Idle"
$lblPhase.Left = 70; $lblPhase.Top = 25; $lblPhase.AutoSize = $true
$grpProg.Controls.Add($lblPhase)

$bar = New-Object Windows.Forms.ProgressBar
$bar.Left = 15; $bar.Top = 50; $bar.Width = 810; $bar.Height = 20
$bar.Style = 'Continuous'; $bar.Minimum = 0; $bar.Maximum = 100; $bar.Value = 0
$grpProg.Controls.Add($bar)

$rtb = New-Object Windows.Forms.RichTextBox
$rtb.Left = 15; $rtb.Top = 80; $rtb.Width = 810; $rtb.Height = 170
$rtb.ReadOnly = $true
$grpProg.Controls.Add($rtb)

# Buttons + Dry-run
$btnStart = New-Object Windows.Forms.Button
$btnStart.Text = "Start"
$btnStart.Left = 585; $btnStart.Top = 600; $btnStart.Width = 80
$form.Controls.Add($btnStart)

$btnImport = New-Object Windows.Forms.Button
$btnImport.Text = "Import changes…"
$btnImport.Left = 670; $btnImport.Top = 600; $btnImport.Width = 110
$form.Controls.Add($btnImport)

$btnPhoto = New-Object Windows.Forms.Button
$btnPhoto.Text = "Update Photos"
$btnPhoto.Left = 470; $btnPhoto.Top = 600; $btnPhoto.Width = 110
$form.Controls.Add($btnPhoto)

$btnCancel = New-Object Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.Left = 785; $btnCancel.Top = 600; $btnCancel.Width = 80
$btnCancel.Enabled = $false
$btnCancel.Add_Click({ $script:CancelRequested = $true; $btnCancel.Enabled = $false })
$form.Controls.Add($btnCancel)

$chkDry = New-Object Windows.Forms.CheckBox
$chkDry.Text = "Dry-run (build payloads only; no changes)"
$chkDry.Left = 15; $chkDry.Top = 600; $chkDry.Width = 300
$chkDry.Checked = $true
$form.Controls.Add($chkDry)

function UI-Update([int]$pct,[string]$ph,[string]$msg){
  if ($pct -lt 0) { $pct = 0 } elseif ($pct -gt 100) { $pct = 100 }
  $bar.Value = $pct
  if ($ph) { $lblPhase.Text = $ph }
  if ($msg) { $rtb.AppendText(("{0} {1}`r`n" -f ((Get-Date).ToString("HH:mm:ss")), $msg)) }
  [System.Windows.Forms.Application]::DoEvents()
}

# ===========================
# Import helpers (Settings Catalog)
# ===========================
function Get-ScDefinitionsCache {
  UI-Update $bar.Value "Settings Catalog" "Loading setting definitions…"
  Ensure-BetaModulesForSection 'Settings Catalog'
  $defs = @{}
  $byName = New-Object 'System.Collections.Generic.Dictionary[string,System.Collections.ArrayList]'
  $allDefs = Get-MgBetaDeviceManagementConfigurationSettingDefinition -All
  foreach ($d in $allDefs) {
    $defs[$d.Id] = $d
    $dn = [string]$d.DisplayName
    if (-not $byName.ContainsKey($dn)) { $byName[$dn] = New-Object System.Collections.ArrayList }
    [void]$byName[$dn].Add($d)
  }
  return @{ ById = $defs; ByName = $byName }
}
function Resolve-DefinitionId { param([hashtable]$DefCache,[string]$SettingName,[string]$SettingPath)
  if ($SettingName -and $DefCache.ByName.ContainsKey($SettingName)) {
    $cands = $DefCache.ByName[$SettingName]
    if ($cands.Count -eq 1) { return $cands[0].Id }
    if ($SettingPath) { foreach ($c in $cands) { if ($c.CategoryPath -eq $SettingPath) { return $c.Id } } }
    return $cands[0].Id
  }
  return $null
}
function Build-SettingInstanceObject { param([string]$DefinitionId,[string]$RawValue)
  if ($RawValue -match '^(?i:true|false)$') {
    $boolVal = [System.Boolean]::Parse($RawValue)
    return @{
      "@odata.type" = "#microsoft.graph.deviceManagementConfigurationSimpleSettingInstance"
      "settingDefinitionId" = $DefinitionId
      "simpleSettingValue"  = @{
        "@odata.type" = "#microsoft.graph.deviceManagementConfigurationBooleanSettingValue"
        "value"       = $boolVal
      }
    }
  } else {
    return @{
      "@odata.type" = "#microsoft.graph.deviceManagementConfigurationSimpleSettingInstance"
      "settingDefinitionId" = $DefinitionId
      "simpleSettingValue"  = @{
        "@odata.type" = "#microsoft.graph.deviceManagementConfigurationStringSettingValue"
        "value"       = $RawValue
      }
    }
  }
}
function Get-PolicyByName { param([string]$Name)
  Ensure-BetaModulesForSection 'Settings Catalog'
  $pols = Get-MgBetaDeviceManagementConfigurationPolicy -All | Where-Object { $_.Name -eq $Name }
  if ($pols.Count -gt 1) { return $pols | Select-Object -First 1 }
  return $pols
}
function Update-ScPolicySettings {
  param([string]$PolicyId,[array]$SettingInstances,[switch]$DryRun)
  $url = "/beta/deviceManagement/configurationPolicies/$PolicyId"
  $body = @{ "settings" = $SettingInstances } | ConvertTo-Json -Depth 10
  if ($DryRun) { return @{ url=$url; body=$body } }
  Invoke-MgGraphRequest -Method PATCH -Uri $url -Body $body -ContentType "application/json"
  return $true
}

# ===========================
# START (Export) logic
# ===========================
$btnStart.Add_Click({
  foreach ($cb in $checks) { $cb.Enabled = $false }
  $btnStart.Enabled = $false
  $btnImport.Enabled = $false
  $btnCancel.Enabled = $true
  $script:CancelRequested = $false

  $OutDir = $txtOut.Text
  Ensure-Dir $OutDir

  # Determine selected sections
  $sections = @()
  if ($chkSC.Checked)   { $sections += "Settings Catalog" }
  if ($chkLEG.Checked)  { $sections += "Legacy Device Config" }
  if ($chkCOMP.Checked) { $sections += "Compliance" }
  if ($chkWU.Checked)   { $sections += "Windows Update" }
  if ($chkES.Checked)   { $sections += "Endpoint Security" }
  if ($chkSR.Checked)   { $sections += "Scripts/Remediations" }
  if ($chkAP.Checked)   { $sections += "Autopilot" }
  if ($chkENR.Checked)  { $sections += "Enrollment" }
  if ($chkFLT.Checked)  { $sections += "Filters/Scope Tags" }
  if ($chkRBAC.Checked) { $sections += "RBAC" }
  if ($chkAPPS.Checked) { $sections += "Apps" }

  if ($sections.Count -eq 0) {
    UI-Update 0 "Idle" "No sections selected."
    foreach ($cb in $checks) { $cb.Enabled = $true }
    $btnStart.Enabled = $true
    $btnImport.Enabled = $true
    $btnCancel.Enabled = $false
    return
  }

  # ---------- Single Auth (minimize so MS sign-in is in front) ----------
  UI-Update 2 "Authenticating" "Connecting to Microsoft Graph (USGov)…"
  $form.TopMost = $false
  $form.WindowState = 'Minimized'
  [System.Windows.Forms.Application]::DoEvents()

  $Scopes = @(
    "DeviceManagementConfiguration.Read.All",
    "DeviceManagementConfiguration.ReadWrite.All",   # write scope so Import can reuse same session
    "DeviceManagementServiceConfig.Read.All",
    "DeviceManagementRBAC.Read.All",
    "DeviceManagementManagedDevices.Read.All",
    "Device.Read.All",
    "User.ReadWrite.All",
    "GroupMember.Read.All",
    "Group.Read.All",
    "DeviceManagementApps.Read.All"
  )

  $authenticated = $false
  try {
    Connect-MgGraph -Environment USGov -Scopes $Scopes -NoWelcome | Out-Null
    $ctx = Get-MgContext
    if ($ctx -and $ctx.Account) { $authenticated = $true }
  } catch { $authenticated = $false }

  # Restore UI and bail if not authenticated
  $form.WindowState = 'Normal'
  $form.Activate()
  $form.TopMost = $true; [System.Windows.Forms.Application]::DoEvents()
  $form.TopMost = $false

  if (-not $authenticated) {
    UI-Update 0 "Auth Required" "Sign-in was cancelled or failed. Nothing was exported."
    foreach ($cb in $checks) { $cb.Enabled = $true }
    $btnStart.Enabled = $true
    $btnImport.Enabled = $true
    $btnCancel.Enabled = $false
    return
  }

  UI-Update 5 "Authenticated" ("Signed in as: {0} (Tenant {1})" -f $ctx.Account, $ctx.TenantId)

  # progress allocation
  $basePct = 5
  $spanPct = 95
  $perSection = [math]::Floor($spanPct / $sections.Count)
  $cursor = $basePct

  $btnPhoto.Add_Click({
  # must be signed in already (reuse same session)
  try {
    $ctx = Get-MgContext
    if (-not $ctx -or -not $ctx.Account) {
      [void][System.Windows.Forms.MessageBox]::Show(
        "Please click Start and sign in first (or run any export) to authenticate, then click Update Photos.",
        "Authentication required",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      )
      return
    }
  } catch {
    [void][System.Windows.Forms.MessageBox]::Show("Please authenticate first.","Authentication required",
      [System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information); return
  }

  # Validate photo file
  if (-not (Test-Path $Photo_FilePath)) {
    [void][System.Windows.Forms.MessageBox]::Show("Photo file not found:`n$Photo_FilePath","File missing",
      [System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error); return
  }

  # Lock UI
  $btnPhoto.Enabled = $false
  $btnStart.Enabled = $false
  $btnImport.Enabled = $false
  foreach ($cb in $checks) { $cb.Enabled = $false }
  $btnCancel.Enabled = $true
  $script:CancelRequested = $false

  try {
    UI-Update 5 "Photos" "Preparing photo job…"
    $refHash = (Get-FileHash -Path $Photo_FilePath -Algorithm MD5).Hash
    $nowUtc  = [DateTime]::UtcNow
    $snap    = Load-PhotoSnapshot -Path $Photo_SnapshotPath

    UI-Update 10 "Photos" ("Loading group '{0}'…" -f $Photo_GroupName)
    $group = Get-MgGroup -Filter "DisplayName eq '$Photo_GroupName'"
    if (-not $group) { throw "Group not found: $Photo_GroupName" }

    UI-Update 12 "Photos" "Enumerating members…"
    $members = Get-MgGroupMember -GroupId $group.Id -All | Where-Object {
      $_.AdditionalProperties['@odata.type'] -eq '#microsoft.graph.user'
    }
    $list = @()
    foreach ($m in $members) { $list += [string]$m.AdditionalProperties['userPrincipalName'] }
    $list = $list | Where-Object { $_ } | Sort-Object -Unique

    $total = [Math]::Max(1,$list.Count)
    $i=0; $updated=0; $skipped=0; $errors=0

    foreach ($upn in $list) {
      if ($script:CancelRequested) { throw "CancelledByUser" }
      $i++
      $pct = 12 + [int](($i/$total) * 86)  # keep a little headroom for snapshot write
      UI-Update $pct "Photos" ("Processing {0} of {1}: {2}" -f $i,$total,$upn)

      if (-not $snap.ContainsKey($upn)) {
        $snap[$upn] = [ordered]@{ lastHash=$null; lastSetUtc=$null; lastVerifiedUtc=$null }
      }
      $entry = $snap[$upn]
      $lastHash = $entry.lastHash
      $lastVerifiedUtc = $entry.lastVerifiedUtc

      # trust snapshot within recheck window
      $withinRecheck = $false
      if ($Photo_RecheckDays -gt 0 -and $lastVerifiedUtc) {
        $withinRecheck = ($nowUtc - [datetime]$lastVerifiedUtc).TotalDays -lt $Photo_RecheckDays
      } elseif ($Photo_RecheckDays -eq 0) {
        $withinRecheck = $true
      }

      if ($lastHash -eq $refHash -and $withinRecheck) {
        $rtb.AppendText("  ⏭️  Skipped (snapshot ok)`r`n")
        $skipped++; continue
      }

      try {
        Set-MgUserPhotoContent -UserId $upn -InFile $Photo_FilePath
        $entry.lastHash        = $refHash
        $entry.lastSetUtc      = $nowUtc.ToString("o")
        $entry.lastVerifiedUtc = $nowUtc.ToString("o")
        $rtb.AppendText("  ✅ Applied`r`n")
        $updated++
      } catch {
        $rtb.AppendText(("  ❌ Error: {0}`r`n" -f $_.Exception.Message))
        $errors++
      } finally {
        Start-Sleep -Milliseconds 120   # gentle pacing
      }

      $snap[$upn] = $entry
    }

    # prune users no longer in group
    $current = [System.Collections.Generic.HashSet[string]]::new([string[]]$list)
    foreach ($key in @($snap.Keys)) { if (-not $current.Contains($key)) { $snap.Remove($key) } }

    UI-Update 98 "Photos" "Saving snapshot…"
    Save-PhotoSnapshot -Map $snap -Path $Photo_SnapshotPath
    UI-Update 100 "Photos" ("Done. Updated={0} Skipped={1} Errors={2}" -f $updated,$skipped,$errors)
  }
  catch {
    if ($_.Exception.Message -eq "CancelledByUser") {
      UI-Update $bar.Value "Cancelled" "Photo job cancelled by user."
    } else {
      UI-Update $bar.Value "Error" ("Photo job stopped: {0}" -f $_.Exception.Message)
    }
  }
  finally {
    $btnCancel.Enabled = $false
    $btnPhoto.Enabled  = $true
    $btnStart.Enabled  = $true
    $btnImport.Enabled = $true
    foreach ($cb in $checks) { $cb.Enabled = $true }
  }
})

  function Check-Cancel {
    if ($script:CancelRequested) {
      UI-Update $cursor "Cancelled" "Stopping at user request."
      throw "CancelledByUser"
    }
  }

  try {
    # -------------- Settings Catalog --------------
    if ($chkSC.Checked) {
      Check-Cancel
      $name = "Settings Catalog"
      Ensure-BetaModulesForSection $name
      $wb = Join-Path $OutDir "Intune_SettingsCatalog.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting policies…"

      $policies = @(); try { $policies = Get-MgBetaDeviceManagementConfigurationPolicy -All } catch { UI-Update $cursor $name "Warning: $($_.Exception.Message)" }
      $defs = @{}
      if ($UseCatalogDefinitions) {
        UI-Update $cursor $name "Fetching setting definitions…"
        try {
          $allDefs = Get-MgBetaDeviceManagementConfigurationSettingDefinition -All
          foreach ($d in $allDefs) { $defs[$d.Id] = $d }
        } catch { UI-Update $cursor $name "Definitions fetch failed; descriptions may be blank." }
      }
      $assignRows = New-Object System.Collections.Generic.List[object]
      $total = [Math]::Max(1,$policies.Count); $i=0
      foreach ($p in $policies) {
        Check-Cancel
        $i++; $pct = $cursor + [int](($i/$total) * ($perSection-5))
        UI-Update $pct $name ("Processing: {0}" -f $p.Name)
        $policyId = $p.Id; $policyName = $p.Name

        $settings = @(); try { $settings = Get-MgBetaDeviceManagementConfigurationPolicySetting -DeviceManagementConfigurationPolicyId $policyId -All } catch {}
        $rows = New-Object System.Collections.Generic.List[object]
        if ($settings.Count -eq 0) {
          $rows.Add([pscustomobject]@{ SettingPath=""; SettingName=""; Value=""; Enabled=$null; Description="" })
        } else {
          foreach ($s in $settings) {
            Check-Cancel
            $defId = $s.Setting.DefinitionId
            $settingPath = $s.Setting.SettingInstanceTemplateReferenceName
            if ([string]::IsNullOrWhiteSpace($settingPath)) { $settingPath = $s.Setting.AdditionalProperties.displayName }
            $settingName = $defId; $desc = ""
            if ($defs.ContainsKey($defId)) {
              $settingName = $defs[$defId].DisplayName
              if ([string]::IsNullOrWhiteSpace($settingPath)) { $settingPath = $defs[$defId].CategoryPath }
              $desc = $defs[$defId].Description
            } elseif ($s.Setting.AdditionalProperties.displayName) { $settingName = $s.Setting.AdditionalProperties.displayName }
            $val = $null
            if ($s.SettingInstance) {
              if ($s.SettingInstance.SimpleSettingValue) { $val = $s.SettingInstance.SimpleSettingValue.Value }
              elseif ($s.SettingInstance.SimpleSettingCollectionValue) { $val = $s.SettingInstance.SimpleSettingCollectionValue.Value }
              elseif ($s.SettingInstance.ChoiceSettingValue) { $val = $s.SettingInstance.ChoiceSettingValue.ChoiceValue }
              else { $val = $s.SettingInstance.AdditionalProperties.value; if (-not $val) { $val = $s.SettingInstance } }
            }
            $norm = Normalize-Value $val
            $rows.Add([pscustomobject]@{
              SettingPath = $settingPath
              SettingName = $settingName
              Value       = $norm.Text
              Enabled     = $norm.Enabled
              Description = $desc
            })
          }
        }
        Write-Sheet -Data $rows -WorkbookPath $wb -WorksheetName $policyName

        $targets = @()
        try { $as = Get-MgBetaDeviceManagementConfigurationPolicyAssignment -DeviceManagementConfigurationPolicyId $policyId -All
              foreach ($a in $as) { $targets += (Resolve-AssignmentTarget $a.Target) } } catch {}
        $assignRows.Add([pscustomobject]@{ ProfileName = $policyName; AssignedTo = ($targets | Select-Object -Unique) -join '; ' })
      }
      UI-Update ($cursor + $perSection - 2) $name "Writing assignments sheet…"
      if ($assignRows.Count -eq 0) { $assignRows.Add([pscustomobject]@{ ProfileName=""; AssignedTo="" }) }
      Write-Sheet -Data ($assignRows | Sort-Object ProfileName) -WorkbookPath $wb -WorksheetName "Assignments"
      UI-Update ($cursor + $perSection) $name "Saved: Intune_SettingsCatalog.xlsx"
      $cursor += $perSection
    }

    # -------------- Legacy Device Config (v1) --------------
    if ($chkLEG.Checked) {
      Check-Cancel
      $name = "Legacy Device Config"
      $wb = Join-Path $OutDir "Intune_DeviceConfig_Legacy.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting profiles…"
      $legacy = @(); try { $legacy = Get-MgDeviceManagementDeviceConfiguration -All } catch { UI-Update $cursor $name "Warning: $($_.Exception.Message)" }
      $assignRows = New-Object System.Collections.Generic.List[object]
      $total = [Math]::Max(1,$legacy.Count); $i=0
      foreach ($lp in $legacy) {
        Check-Cancel
        $i++; $pct = $cursor + [int](($i/$total) * ($perSection-5))
        UI-Update $pct $name ("Processing: {0}" -f $lp.DisplayName)
        $policyId = $lp.Id; $policyName = $lp.DisplayName

        $props = @{}
        $lp.PSObject.Properties | ForEach-Object {
          if ($_ -and $_.Name -and $_.Value -ne $null) {
            $n = $_.Name
            if ($n -in @('Id','DisplayName','Description','Version','OdataType','CreatedDateTime','LastModifiedDateTime','Assignments','@odata.type')) { return }
            $props[$n] = $_.Value
          }
        }
        $rows = New-Object System.Collections.Generic.List[object]
        if ($props.Count -eq 0) {
          $rows.Add([pscustomobject]@{ SettingPath=""; SettingName=""; Value=""; Enabled=$null; Description="" })
        } else {
          foreach ($kvp in $props.GetEnumerator()) {
            Check-Cancel
            $norm = Normalize-Value $kvp.Value
            $rows.Add([pscustomobject]@{ SettingPath = ""; SettingName = $kvp.Key; Value = $norm.Text; Enabled = $norm.Enabled; Description = "" })
          }
        }
        Write-Sheet -Data $rows -WorkbookPath $wb -WorksheetName $policyName

        $targets = @()
        try { $as = Get-MgDeviceManagementDeviceConfigurationAssignment -DeviceConfigurationId $policyId -All
              foreach ($a in $as) { $targets += (Resolve-AssignmentTarget $a.Target) } } catch {}
        $assignRows.Add([pscustomobject]@{ ProfileName = $policyName; AssignedTo = ($targets | Select-Object -Unique) -join '; ' })
      }
      UI-Update ($cursor + $perSection - 2) $name "Writing assignments sheet…"
      if ($assignRows.Count -eq 0) { $assignRows.Add([pscustomobject]@{ ProfileName=""; AssignedTo="" }) }
      Write-Sheet -Data ($assignRows | Sort-Object ProfileName) -WorkbookPath $wb -WorksheetName "Assignments"
      UI-Update ($cursor + $perSection) $name "Saved: Intune_DeviceConfig_Legacy.xlsx"
      $cursor += $perSection
    }

    # -------------- Compliance (v1 summary) --------------
    if ($chkCOMP.Checked) {
      Check-Cancel
      $name = "Compliance"
      $wb = Join-Path $OutDir "Intune_Compliance.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting policies…"
      $comp = @(); try { $comp = Get-MgDeviceManagementDeviceCompliancePolicy -All } catch {}
      $rows = New-Object System.Collections.Generic.List[object]
      $total=[Math]::Max(1,$comp.Count); $i=0
      foreach ($c in $comp) {
        Check-Cancel
        $i++; $pct=$cursor + [int](($i/$total) * ($perSection-5))
        UI-Update $pct $name ("Processing: {0}" -f $c.DisplayName)
        $targets=@()
        try { $as = Get-MgDeviceManagementDeviceCompliancePolicyAssignment -DeviceCompliancePolicyId $c.Id -All
              foreach ($a in $as) { $targets += (Resolve-AssignmentTarget $a.Target) } } catch {}
        $rows.Add([pscustomobject]@{
          PolicyName=$c.DisplayName; PolicyId=$c.Id; Platform=$c.OdataType; AssignedTo=($targets | Select-Object -Unique) -join '; '
        })
      }
      if ($rows.Count -eq 0) { $rows.Add([pscustomobject]@{}) }
      Write-Sheet -Data $rows -WorkbookPath $wb -WorksheetName "Compliance"
      UI-Update ($cursor + $perSection) $name "Saved: Intune_Compliance.xlsx"
      $cursor += $perSection
    }

    # -------------- Windows Update (beta + v1) --------------
    if ($chkWU.Checked) {
      Check-Cancel
      $name = "Windows Update"
      Ensure-BetaModulesForSection $name
      $wb = Join-Path $OutDir "Intune_WindowsUpdate.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting WUFB Rings…"
      $wur = @(); try { $wur = Get-MgDeviceManagementDeviceConfiguration -All | Where-Object { $_.OdataType -match "windowsUpdateForBusinessConfiguration" } } catch {}
      Write-Sheet -Data ($wur | Select-Object DisplayName,Id,OdataType) -WorkbookPath $wb -WorksheetName "WU_Rings"

      UI-Update ($cursor + [int]($perSection*0.5)) $name "Feature/Quality/Driver profiles…"
      try { $wf = Get-MgBetaDeviceManagementWindowsFeatureUpdateProfile -All
            Write-Sheet -Data ($wf | Select-Object DisplayName,Id,ReleaseType,RoleScopeTagIds) -WorkbookPath $wb -WorksheetName "WU_Feature" } catch {}
      try { $wq = Get-MgBetaDeviceManagementWindowsQualityUpdateProfile -All
            Write-Sheet -Data ($wq | Select-Object DisplayName,Id,Description,RoleScopeTagIds) -WorkbookPath $wb -WorksheetName "WU_Quality" } catch {}
      try { $wd = Get-MgBetaDeviceManagementWindowsDriverUpdateProfile -All
            Write-Sheet -Data ($wd | Select-Object DisplayName,Id,ApprovalType,RoleScopeTagIds) -WorkbookPath $wb -WorksheetName "WU_Driver" } catch {}
      UI-Update ($cursor + $perSection) $name "Saved: Intune_WindowsUpdate.xlsx"
      $cursor += $perSection
    }

    # -------------- Endpoint Security (beta) --------------
    if ($chkES.Checked) {
      Check-Cancel
      $name = "Endpoint Security"
      Ensure-BetaModulesForSection $name
      $wb = Join-Path $OutDir "Intune_EndpointSecurity.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting intents…"
      try {
        $intents = Get-MgBetaDeviceManagementIntent -All
        $rows = New-Object System.Collections.Generic.List[object]
        $total=[Math]::Max(1,$intents.Count); $i=0
        foreach ($it in $intents) {
          Check-Cancel
          $i++; $pct=$cursor + [int](($i/$total) * ($perSection-5))
          UI-Update $pct $name ("Processing: {0}" -f $it.DisplayName)
          $targets=@(); try { $as = Get-MgBetaDeviceManagementIntentAssignment -DeviceManagementIntentId $it.Id -All
                              foreach ($a in $as) { $targets += (Resolve-AssignmentTarget $a.Target) } } catch {}
          $rows.Add([pscustomobject]@{ Name=$it.DisplayName; Id=$it.Id; TemplateId=$it.TemplateId; AssignedTo=($targets | Select-Object -Unique) -join '; ' })
        }
        if ($rows.Count -eq 0) { $rows = ,([pscustomobject]@{}) }
        Write-Sheet -Data $rows -WorkbookPath $wb -WorksheetName "EndpointSecurity"
      } catch {
        UI-Update $cursor $name "Warning: $($_.Exception.Message)"
      }
      UI-Update ($cursor + $perSection) $name "Saved: Intune_EndpointSecurity.xlsx"
      $cursor += $perSection
    }

    # -------------- Scripts / Remediations (beta + v1) --------------
    if ($chkSR.Checked) {
      Check-Cancel
      $name = "Scripts/Remediations"
      Ensure-BetaModulesForSection $name
      $wb = Join-Path $OutDir "Intune_Scripts_Remediations.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting…"
      try { $winScripts = Get-MgDeviceManagementScript -All | Select-Object DisplayName,Id,FileName,RunAsAccount,EnforceSignatureCheck
            Write-Sheet -Data $winScripts -WorkbookPath $wb -WorksheetName "Win_PSScripts" } catch {}
      try { $macScripts = Get-MgDeviceManagementShellScript -All | Select-Object DisplayName,Id,FileName,RunAsAccount
            Write-Sheet -Data $macScripts -WorkbookPath $wb -WorksheetName "macOS_ShellScripts" } catch {}
      try { $remed = Get-MgBetaDeviceManagementDeviceHealthScript -All | Select-Object DisplayName,Id,Publisher,LastModifiedDateTime
            Write-Sheet -Data $remed -WorkbookPath $wb -WorksheetName "ProactiveRemediation" } catch {}
      UI-Update ($cursor + $perSection) $name "Saved: Intune_Scripts_Remediations.xlsx"
      $cursor += $perSection
    }

    # -------------- Autopilot (beta) --------------
    if ($chkAP.Checked) {
      Check-Cancel
      $name = "Autopilot"
      Ensure-BetaModulesForSection $name
      $wb = Join-Path $OutDir "Intune_Autopilot.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting profiles/devices…"
      try { $apProfiles = Get-MgBetaDeviceManagementWindowsAutopilotDeploymentProfile -All | Select-Object DisplayName,Id,Description,EnrollmentStatusScreenSettings
            Write-Sheet -Data $apProfiles -WorkbookPath $wb -WorksheetName "Profiles" } catch {}
      try { $apDevices = Get-MgBetaDeviceManagementWindowsAutopilotDeviceIdentity -All | Select-Object Id,DisplayName,SerialNumber,Manufacturer,Model,DeploymentProfileAssignmentStatus
            Write-Sheet -Data $apDevices -WorkbookPath $wb -WorksheetName "Devices" } catch {}
      UI-Update ($cursor + $perSection) $name "Saved: Intune_Autopilot.xlsx"
      $cursor += $perSection
    }

    # -------------- Enrollment (v1) --------------
    if ($chkENR.Checked) {
      Check-Cancel
      $name = "Enrollment"
      $wb = Join-Path $OutDir "Intune_Enrollment.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting enrollment configs…"
      try {
        $enrollCfg = Get-MgDeviceManagementDeviceEnrollmentConfiguration -All | Select-Object Id,DisplayName,Description,OdataType,Priority
        Write-Sheet -Data $enrollCfg -WorkbookPath $wb -WorksheetName "Enrollment_Configs"
      } catch {
        UI-Update $cursor $name "Warning: $($_.Exception.Message)"
      }
      UI-Update ($cursor + $perSection) $name "Saved: Intune_Enrollment.xlsx"
      $cursor += $perSection
    }

    # -------------- Filters / Scope Tags (beta + v1) --------------
    if ($chkFLT.Checked) {
      Check-Cancel
      $name = "Filters/Scope Tags"
      Ensure-BetaModulesForSection $name
      $wb = Join-Path $OutDir "Intune_Filters_ScopeTags.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting filters/tags…"
      try { $filters = Get-MgBetaDeviceManagementAssignmentFilter -All | Select-Object Id,DisplayName,Platform,Rule
            Write-Sheet -Data $filters -WorkbookPath $wb -WorksheetName "AssignmentFilters" } catch {}
      try { $tags = Get-MgDeviceManagementRoleScopeTag -All | Select-Object Id,DisplayName,Description
            Write-Sheet -Data $tags -WorkbookPath $wb -WorksheetName "ScopeTags" } catch {}
      UI-Update ($cursor + $perSection) $name "Saved: Intune_Filters_ScopeTags.xlsx"
      $cursor += $perSection
    }

    # -------------- RBAC (v1) --------------
    if ($chkRBAC.Checked) {
      Check-Cancel
      $name = "RBAC"
      $wb = Join-Path $OutDir "Intune_RBAC.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting roles/assignments…"
      try {
        $roles = Get-MgDeviceManagementRoleDefinition -All | Select-Object Id,DisplayName,Description,IsBuiltIn
        Write-Sheet -Data $roles -WorkbookPath $wb -WorksheetName "RoleDefinitions"
        $assigns = Get-MgDeviceManagementRoleAssignment -All | Select-Object Id,DisplayName,RoleDefinitionId,ScopeMembers,Members
        Write-Sheet -Data $assigns -WorkbookPath $wb -WorksheetName "RoleAssignments"
      } catch {
        UI-Update $cursor $name "Warning: $($_.Exception.Message)"
      }
      UI-Update ($cursor + $perSection) $name "Saved: Intune_RBAC.xlsx"
      $cursor += $perSection
    }

    # -------------- Apps (v1) --------------
    if ($chkAPPS.Checked) {
      Check-Cancel
      $name = "Apps"
      $wb = Join-Path $OutDir "Intune_Apps.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting apps…"
      try {
        $apps = Get-MgDeviceAppManagementMobileApp -All | Select-Object Id,DisplayName,Publisher,IsFeatured,CreatedDateTime,LastModifiedDateTime,AdditionalProperties
        Write-Sheet -Data $apps -WorkbookPath $wb -WorksheetName "Apps"

        $appAssign = New-Object System.Collections.Generic.List[object]
        $total=[Math]::Max(1,$apps.Count); $i=0
        foreach ($a in $apps) {
          Check-Cancel
          $i++; $pct=$cursor + [int](($i/$total) * ($perSection-10))
          UI-Update $pct $name ("Assignments: {0}" -f $a.DisplayName)
          try {
            $as = Get-MgDeviceAppManagementMobileAppAssignment -MobileAppId $a.Id -All
            $targets = @()
            foreach ($t in $as) { $targets += (Resolve-AssignmentTarget $t.Target) }
            $appAssign.Add([pscustomobject]@{ AppName = $a.DisplayName; AppId=$a.Id; AssignedTo = ($targets | Select-Object -Unique) -join '; ' })
          } catch {}
        }
        if ($appAssign.Count -eq 0) { $appAssign.Add([pscustomobject]@{}) }
        Write-Sheet -Data $appAssign -WorkbookPath $wb -WorksheetName "App_Assignments"
      } catch {
        UI-Update $cursor $name "Warning: $($_.Exception.Message)"
      }
      UI-Update ($cursor + $perSection) $name "Saved: Intune_Apps.xlsx"
      $cursor += $perSection
    }

    UI-Update 100 "Done" ("All selected sections exported to {0}" -f $OutDir)
  }
  catch {
    if ($_.Exception.Message -eq "CancelledByUser") {
      UI-Update $bar.Value "Cancelled" "Export cancelled by user."
    } else {
      UI-Update $bar.Value "Error" ("Stopped: {0}" -f $_.Exception.Message)
    }
  }
  finally {
    $btnCancel.Enabled = $false
    $btnStart.Enabled = $true
    $btnImport.Enabled = $true
    foreach ($cb in $checks) { $cb.Enabled = $true }
  }
})

# ===========================
# IMPORT (Settings Catalog) logic
# ===========================
$btnImport.Add_Click({
  # Must be signed in already (reuse same session)
  try {
    $ctx = Get-MgContext
    if (-not $ctx -or -not $ctx.Account) {
      [void][System.Windows.Forms.MessageBox]::Show(
        "Please click Start and sign in first, then click Import.", "Authentication required",
        [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information
      )
      return
    }
  } catch {
    [void][System.Windows.Forms.MessageBox]::Show(
      "Please click Start and sign in first, then click Import.", "Authentication required",
      [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information
    )
    return
  }

  # Pick workbook (your edited Settings Catalog export)
  $ofd = New-Object System.Windows.Forms.OpenFileDialog
  $ofd.Title = "Pick Settings Catalog workbook to import"
  $ofd.Filter = "Excel Workbook (*.xlsx)|*.xlsx"
  if ($ofd.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
  $wbPath = $ofd.FileName

  # Guard: currently import supports Settings Catalog workbooks
  if ($wbPath -notmatch 'SettingsCatalog') {
    $ok = [System.Windows.Forms.MessageBox]::Show(
      "Heads-up: Import currently supports Settings Catalog only.`nSelected:`n$wbPath`nContinue anyway?",
      "Limited import support",
      [System.Windows.Forms.MessageBoxButtons]::OKCancel,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($ok -ne [System.Windows.Forms.DialogResult]::OK) { return }
  }

  $isDry = $chkDry.Checked
  if ($isDry) {
  $modeText = "DRY-RUN (no changes)"
} else {
  $modeText = "APPLY (updates will be pushed)"
}
  $resp = [System.Windows.Forms.MessageBox]::Show(
    "Proceed to import Settings Catalog changes from:`n$wbPath`nMode: $modeText",
    "Confirm import",
    [System.Windows.Forms.MessageBoxButtons]::OKCancel,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  if ($resp -ne [System.Windows.Forms.DialogResult]::OK) { return }

  # Lock UI
  $btnImport.Enabled = $false
  $btnStart.Enabled  = $false
  foreach ($cb in $checks) { $cb.Enabled = $false }
  $btnCancel.Enabled = $true
  $script:CancelRequested = $false

  try {
    UI-Update 10 "Import (Settings Catalog)" "Reading workbook…"
    Ensure-BetaModulesForSection 'Settings Catalog'

    $defCache = Get-ScDefinitionsCache

    # Read all worksheets except 'Assignments'
    $sheets = (Import-Excel -Path $wbPath -PassThru).WorkSheets |
              Where-Object { $_.Name -ne 'Assignments' }

    $outDir = Join-Path (Split-Path $wbPath) "ImportPayloads"
    if (-not (Test-Path $outDir)) { New-Item -Path $outDir -ItemType Directory -Force | Out-Null }

    $sheetIndex = 0
    foreach ($ws in $sheets) {
      if ($script:CancelRequested) { throw "CancelledByUser" }
      $sheetIndex++
      $pct = 10 + [int](($sheetIndex / [Math]::Max(1,$sheets.Count)) * 80)
      $pName = $ws.Name
      UI-Update $pct "Import (Settings Catalog)" "Policy: $pName"

      $rows = Import-Excel -Path $wbPath -WorksheetName $pName
      if (-not $rows -or $rows.Count -eq 0) { continue }

      $policy = Get-PolicyByName -Name $pName
      if (-not $policy) {
        UI-Update $pct "Import (Settings Catalog)" "⚠️ Policy not found in tenant: $pName (skipping)"
        continue
      }

      $instances = @(); $skipped = 0
      foreach ($r in $rows) {
        if ($script:CancelRequested) { throw "CancelledByUser" }

        $settingName = [string]$r.SettingName
        $settingPath = [string]$r.SettingPath
        $valueStr    = [string]$r.Value

        if ([string]::IsNullOrWhiteSpace($settingName)) { continue }
        if ([string]::IsNullOrWhiteSpace($valueStr))    { continue }  # skip blanks in v1

        $defId = Resolve-DefinitionId -DefCache $defCache -SettingName $settingName -SettingPath $settingPath
        if (-not $defId) { $skipped++; continue }

        try { $instances += (Build-SettingInstanceObject -DefinitionId $defId -RawValue $valueStr) }
        catch { $skipped++ }
      }

      if ($instances.Count -eq 0) {
        UI-Update $pct "Import (Settings Catalog)" "No updatable rows in $pName (skipped $skipped)."
        continue
      }

      $payload = Update-ScPolicySettings -PolicyId $policy.Id -SettingInstances $instances -DryRun:$isDry
      $jsonPath = Join-Path $outDir ("{0}_{1:yyyyMMddHHmmss}.json" -f ($pName -replace '[\\/:*?""<>|]','_'), (Get-Date))
      if ($isDry -and $payload -is [hashtable]) {
        $payload.body | Out-File -FilePath $jsonPath -Encoding UTF8
        UI-Update $pct "Import (Settings Catalog)" "Dry-run: wrote payload → $jsonPath"
      } else {
        ($instances | ConvertTo-Json -Depth 10) | Out-File -FilePath $jsonPath -Encoding UTF8
        UI-Update $pct "Import (Settings Catalog)" "Applied: $pName (payload saved → $jsonPath). Skipped: $skipped"
      }
    }

    UI-Update 100 "Import (Settings Catalog)" ("Done. Payloads saved in: {0}" -f $outDir)
  }
  catch {
    if ($_.Exception.Message -eq "CancelledByUser") {
      UI-Update $bar.Value "Cancelled" "Import cancelled by user."
    } else {
      UI-Update $bar.Value "Error" ("Import stopped: {0}" -f $_.Exception.Message)
    }
  }
  finally {
    $btnImport.Enabled = $true
    $btnStart.Enabled  = $true
    foreach ($cb in $checks) { $cb.Enabled = $true }
    $btnCancel.Enabled = $false
  }
})

[void]$form.ShowDialog()
