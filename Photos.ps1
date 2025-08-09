# Intune Audit (USGov) – Single Auth + GUI (Pick Sections, Start/Cancel) + Progress
# Requires: PowerShell with -STA, Graph SDK modules, ImportExcel
# Install once if needed:
#   Install-Module Microsoft.Graph.Authentication,Microsoft.Graph.Beta.DeviceManagement,Microsoft.Graph.DeviceManagement,Microsoft.Graph.Groups,Microsoft.Graph.DeviceAppManagement -Scope CurrentUser
#   Install-Module ImportExcel -Scope CurrentUser

# ---------------- Config ----------------
$OutDir = "C:\IntuneExports"
$UseCatalogDefinitions = $true   # Include friendly names + Description for Settings Catalog



# ---------------- Modules ----------------
Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
Import-Module Microsoft.Graph.Beta.DeviceManagement -ErrorAction Stop
Import-Module Microsoft.Graph.DeviceManagement -ErrorAction Stop
Import-Module Microsoft.Graph.Groups -ErrorAction Stop
Import-Module Microsoft.Graph.DeviceAppManagement -ErrorAction SilentlyContinue
Import-Module ImportExcel -ErrorAction Stop

# ---------------- Helpers ----------------
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

# ---------------- GUI ----------------
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:CancelRequested = $false

$form = New-Object Windows.Forms.Form
$form.Text = "Intune Audit (USGov) – Select Sections"
$form.StartPosition = 'CenterScreen'
$form.Width = 900; $form.Height = 650
$form.TopMost = $true

# Section selector group
$grp = New-Object Windows.Forms.GroupBox
$grp.Text = "Sections to Export"
$grp.Left = 15; $grp.Top = 10; $grp.Width = 850; $grp.Height = 220
$form.Controls.Add($grp)

# Checkboxes (wrapped; fix & with &&)
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
$grpProg.Left = 15; $grpProg.Top = 320; $grpProg.Width = 850; $grpProg.Height = 250
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
$rtb.Left = 15; $rtb.Top = 80; $rtb.Width = 810; $rtb.Height = 150
$rtb.ReadOnly = $true
$grpProg.Controls.Add($rtb)

# Buttons
$btnStart = New-Object Windows.Forms.Button
$btnStart.Text = "Start"
$btnStart.Left = 665; $btnStart.Top = 580; $btnStart.Width = 90
$form.Controls.Add($btnStart)

$btnCancel = New-Object Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.Left = 775; $btnCancel.Top = 580; $btnCancel.Width = 90
$btnCancel.Enabled = $false
$btnCancel.Add_Click({ $script:CancelRequested = $true; $btnCancel.Enabled = $false })
$form.Controls.Add($btnCancel)

function UI-Update([int]$pct,[string]$ph,[string]$msg){
  if ($pct -lt 0) { $pct = 0 } elseif ($pct -gt 100) { $pct = 100 }
  $bar.Value = $pct
  if ($ph) { $lblPhase.Text = $ph }
  if ($msg) { $rtb.AppendText(("{0} {1}`r`n" -f ((Get-Date).ToString("HH:mm:ss")), $msg)) }
  [System.Windows.Forms.Application]::DoEvents()
}

# ---------------- Run Logic ----------------
$btnStart.Add_Click({
  foreach ($cb in $checks) { $cb.Enabled = $false }
  $btnStart.Enabled = $false
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
    $btnCancel.Enabled = $false
    return
  }

  # ---------- Single Auth (force MS sign-in to front by minimizing this form) ----------
  UI-Update 2 "Authenticating" "Connecting to Microsoft Graph (USGov)…"
  $form.TopMost = $false
  $form.WindowState = 'Minimized'
  [System.Windows.Forms.Application]::DoEvents()

  $Scopes = @(
    "DeviceManagementConfiguration.Read.All",
    "DeviceManagementServiceConfig.Read.All",
    "DeviceManagementRBAC.Read.All",
    "DeviceManagementManagedDevices.Read.All",
    "Device.Read.All",
    "Group.Read.All",
    "DeviceManagementApps.Read.All"
  )

  $authenticated = $false
  try {
    Connect-MgGraph -Environment USGov -Scopes $Scopes -NoWelcome | Out-Null
    $ctx = Get-MgContext
    if ($ctx -and $ctx.Account) { $authenticated = $true }
  } catch {
    $authenticated = $false
  }

  # Restore UI
  $form.WindowState = 'Normal'
  $form.Activate()
  $form.TopMost = $true; [System.Windows.Forms.Application]::DoEvents()
  $form.TopMost = $false

  if (-not $authenticated) {
    UI-Update 0 "Auth Required" "Sign-in was cancelled or failed. Nothing was exported."
    foreach ($cb in $checks) { $cb.Enabled = $true }
    $btnStart.Enabled = $true
    $btnCancel.Enabled = $false
    return
  }

  UI-Update 5 "Authenticated" ("Signed in as: {0} (Tenant {1})" -f $ctx.Account, $ctx.TenantId)

  # progress allocation
  $basePct = 5
  $spanPct = 95
  $perSection = [math]::Floor($spanPct / $sections.Count)
  $cursor = $basePct

  function Check-Cancel {
    if ($script:CancelRequested) {
      UI-Update $cursor "Cancelled" "Stopping at user request."
      throw "CancelledByUser"
    }
  }

  try {
    # ----------------- Settings Catalog -----------------
    if ($chkSC.Checked) {
      Check-Cancel
      $name = "Settings Catalog"
      $wb = Join-Path $OutDir "Intune_SettingsCatalog.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting policies…"

      $policies = @()
      try { $policies = Get-MgBetaDeviceManagementConfigurationPolicy -All } catch { UI-Update $cursor $name "Warning: $($_.Exception.Message)" }

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
            } elseif ($s.Setting.AdditionalProperties.displayName) {
              $settingName = $s.Setting.AdditionalProperties.displayName
            }

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
        $assignRows.Add([pscustomobject]@{
          ProfileName = $policyName
          AssignedTo  = ($targets | Select-Object -Unique) -join '; '
        })
      }

      UI-Update ($cursor + $perSection - 2) $name "Writing assignments sheet…"
      if ($assignRows.Count -eq 0) { $assignRows.Add([pscustomobject]@{ ProfileName=""; AssignedTo="" }) }
      Write-Sheet -Data ($assignRows | Sort-Object ProfileName) -WorkbookPath $wb -WorksheetName "Assignments"
      UI-Update ($cursor + $perSection) $name "Saved: Intune_SettingsCatalog.xlsx"
      $cursor += $perSection
    }

    # ----------------- Legacy Device Config -----------------
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
            $rows.Add([pscustomobject]@{
              SettingPath = ""
              SettingName = $kvp.Key
              Value       = $norm.Text
              Enabled     = $norm.Enabled
              Description = ""
            })
          }
        }
        Write-Sheet -Data $rows -WorkbookPath $wb -WorksheetName $policyName

        $targets = @()
        try { $as = Get-MgDeviceManagementDeviceConfigurationAssignment -DeviceConfigurationId $policyId -All
              foreach ($a in $as) { $targets += (Resolve-AssignmentTarget $a.Target) } } catch {}
        $assignRows.Add([pscustomobject]@{
          ProfileName = $policyName
          AssignedTo  = ($targets | Select-Object -Unique) -join '; '
        })
      }
      UI-Update ($cursor + $perSection - 2) $name "Writing assignments sheet…"
      if ($assignRows.Count -eq 0) { $assignRows.Add([pscustomobject]@{ ProfileName=""; AssignedTo="" }) }
      Write-Sheet -Data ($assignRows | Sort-Object ProfileName) -WorkbookPath $wb -WorksheetName "Assignments"
      UI-Update ($cursor + $perSection) $name "Saved: Intune_DeviceConfig_Legacy.xlsx"
      $cursor += $perSection
    }

    # ----------------- Compliance -----------------
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

    # ----------------- Windows Update -----------------
    if ($chkWU.Checked) {
      Check-Cancel
      $name = "Windows Update"
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

    # ----------------- Endpoint Security -----------------
    if ($chkES.Checked) {
      Check-Cancel
      $name = "Endpoint Security"
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

    # ----------------- Scripts / Remediations -----------------
    if ($chkSR.Checked) {
      Check-Cancel
      $name = "Scripts/Remediations"
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

    # ----------------- Autopilot -----------------
    if ($chkAP.Checked) {
      Check-Cancel
      $name = "Autopilot"
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

    # ----------------- Enrollment -----------------
    if ($chkENR.Checked) {
      Check-Cancel
      $name = "Enrollment"
      $wb = Join-Path $OutDir "Intune_Enrollment.xlsx"
      if (Test-Path $wb) { Remove-Item $wb -Force }
      UI-Update $cursor $name "Collecting enrollment configs…"

      try {
        $enrollCfg = Get-MgDeviceManagementDeviceEnrollmentConfiguration -All |
          Select-Object Id,DisplayName,Description,OdataType,Priority
        Write-Sheet -Data $enrollCfg -WorkbookPath $wb -WorksheetName "Enrollment_Configs"
      } catch {
        UI-Update $cursor $name "Warning: $($_.Exception.Message)"
      }

      UI-Update ($cursor + $perSection) $name "Saved: Intune_Enrollment.xlsx"
      $cursor += $perSection
    }

    # ----------------- Filters / Scope Tags -----------------
    if ($chkFLT.Checked) {
      Check-Cancel
      $name = "Filters/Scope Tags"
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

    # ----------------- RBAC -----------------
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

    # ----------------- Apps -----------------
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
            $appAssign.Add([pscustomobject]@{
              AppName = $a.DisplayName; AppId=$a.Id; AssignedTo = ($targets | Select-Object -Unique) -join '; '
            })
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
      UI-Update $bar.Value "Cancelled" "Audit cancelled by user."
    } else {
      UI-Update $bar.Value "Error" ("Stopped: {0}" -f $_.Exception.Message)
    }
  }
  finally {
    $btnCancel.Enabled = $false
    $btnStart.Enabled = $true
    foreach ($cb in $checks) { $cb.Enabled = $true }
  }
})

[void]$form.ShowDialog()
