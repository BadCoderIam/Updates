# MainMenu.ps1 – Intune Tools Launcher (USGov)
# Auth once, then open modular windows: Audit, Update Photos, Outlook, License Check

# --- Minimal dependencies (install once beforehand) ---
Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
Import-Module Microsoft.Graph.Users -ErrorAction SilentlyContinue
Import-Module Microsoft.Graph.Groups -ErrorAction SilentlyContinue

# --- Shared scopes (add as you add features) ---
$Global:IntuneScopes = @(
  # Intune (export/import)
  "DeviceManagementConfiguration.Read.All",
  "DeviceManagementConfiguration.ReadWrite.All",
  "DeviceManagementServiceConfig.Read.All",
  "DeviceManagementRBAC.Read.All",
  "DeviceManagementManagedDevices.Read.All",
  "Device.Read.All",
  "Group.Read.All",
  "DeviceManagementApps.Read.All",

  # Photos feature
  "User.ReadWrite.All",
  "GroupMember.Read.All"
)

# --- Shared state you can pass into child windows ---
$Global:AppState = [ordered]@{
  Environment = "USGov"
  IsAuthenticated = $false
}

function Ensure-Graph {
  param([switch]$Force)
  try { $ctx = Get-MgContext -ErrorAction Stop } catch { $ctx = $null }
  $need = $Force -or -not $ctx -or -not $ctx.Account -or $ctx.Environment -ne $Global:AppState.Environment
  if ($need) {
    # Bring SSO to front (minimize briefly)
    $form.WindowState = 'Minimized'
    [System.Windows.Forms.Application]::DoEvents()
    try {
      Connect-MgGraph -Environment $Global:AppState.Environment -Scopes $Global:IntuneScopes -NoWelcome | Out-Null
      $ctx = Get-MgContext
      $Global:AppState.IsAuthenticated = $true
      $Global:AppState.Account = $ctx.Account
      $Global:AppState.TenantId = $ctx.TenantId
    } catch {
      $Global:AppState.IsAuthenticated = $false
      throw
    } finally {
      $form.WindowState = 'Normal'
      $form.Activate()
    }
  } else {
    $Global:AppState.IsAuthenticated = $true
    $Global:AppState.Account = $ctx.Account
    $Global:AppState.TenantId = $ctx.TenantId
  }
}

# --- UI ---
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object Windows.Forms.Form
$form.Text = "Intune Tools – Main Menu (USGov)"
$form.StartPosition = 'CenterScreen'
$form.Width = 520; $form.Height = 320
$form.TopMost = $true

$lbl = New-Object Windows.Forms.Label
$lbl.Text = "Authenticate, then pick a tool:"
$lbl.Left = 20; $lbl.Top = 20; $lbl.AutoSize = $true
$form.Controls.Add($lbl)

$lblAcct = New-Object Windows.Forms.Label
$lblAcct.Text = "Not signed in"
$lblAcct.Left = 20; $lblAcct.Top = 45; $lblAcct.Width = 450
$form.Controls.Add($lblAcct)

$btnAuth = New-Object Windows.Forms.Button
$btnAuth.Text = "Authenticate"
$btnAuth.Left = 20; $btnAuth.Top = 75; $btnAuth.Width = 120
$form.Controls.Add($btnAuth)

$btnAudit   = New-Object Windows.Forms.Button;   $btnAudit.Text   = "Audit"
$btnPhotos  = New-Object Windows.Forms.Button;   $btnPhotos.Text  = "Update Photos"
$btnOutlook = New-Object Windows.Forms.Button;   $btnOutlook.Text = "Outlook"
$btnLicense = New-Object Windows.Forms.Button;   $btnLicense.Text = "License check"

$btnAudit.Left=20;  $btnAudit.Top=120;  $btnAudit.Width=200
$btnPhotos.Left=240; $btnPhotos.Top=120; $btnPhotos.Width=200
$btnOutlook.Left=20; $btnOutlook.Top=170; $btnOutlook.Width=200
$btnLicense.Left=240; $btnLicense.Top=170; $btnLicense.Width=200

$buttons = @($btnAudit,$btnPhotos,$btnOutlook,$btnLicense)
foreach($b in $buttons){ $b.Enabled=$false; $form.Controls.Add($b) }

$btnClose = New-Object Windows.Forms.Button
$btnClose.Text = "Close"
$btnClose.Left = 380; $btnClose.Top = 230; $btnClose.Width = 80
$form.Controls.Add($btnClose)

# --- Handlers ---
$btnAuth.Add_Click({
  try {
    Ensure-Graph -Force
    if ($Global:AppState.IsAuthenticated) {
      $lblAcct.Text = "Signed in as: $($Global:AppState.Account)  Tenant: $($Global:AppState.TenantId)"
      foreach($b in $buttons){ $b.Enabled = $true }
    }
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Authentication failed or cancelled.`n$($_.Exception.Message)","Auth",0,48) | Out-Null
  }
})

function Run-ChildWindow {
  param([string]$ScriptPath,[string]$ExportedFunction,[hashtable]$Args)
  if (-not (Test-Path $ScriptPath)) {
    [System.Windows.Forms.MessageBox]::Show("File not found:`n$ScriptPath","Missing",0,16) | Out-Null
    return
  }
  # Dot-source to reuse current session/auth
  . $ScriptPath
  if (-not (Get-Command $ExportedFunction -ErrorAction SilentlyContinue)) {
    [System.Windows.Forms.MessageBox]::Show("Function '$ExportedFunction' not found in:`n$ScriptPath","Error",0,16) | Out-Null
    return
  }
  # Hide/disable main while child runs
  $form.Enabled = $false
  try {
    & $ExportedFunction -AppState $Global:AppState @Args
  } finally {
    $form.Enabled = $true
    $form.Activate()
  }
}

$btnPhotos.Add_Click({
  if (-not $Global:AppState.IsAuthenticated) { $btnAuth.PerformClick(); if (-not $Global:AppState.IsAuthenticated) { return } }
  Run-ChildWindow -ScriptPath "C:\IntuneTools\PhotoWindow.ps1" -ExportedFunction "Show-PhotoWindow" -Args @{}
})

$btnAudit.Add_Click({
  if (-not $Global:AppState.IsAuthenticated) { $btnAuth.PerformClick(); if (-not $Global:AppState.IsAuthenticated) { return } }
  Run-ChildWindow -ScriptPath "C:\IntuneTools\AuditWindow.ps1" -ExportedFunction "Show-AuditWindow" -Args @{}
})

$btnOutlook.Add_Click({
  if (-not $Global:AppState.IsAuthenticated) { $btnAuth.PerformClick(); if (-not $Global:AppState.IsAuthenticated) { return } }
  Run-ChildWindow -ScriptPath "C:\IntuneTools\OutlookWindow.ps1" -ExportedFunction "Show-OutlookWindow" -Args @{}
})

$btnLicense.Add_Click({
  if (-not $Global:AppState.IsAuthenticated) { $btnAuth.PerformClick(); if (-not $Global:AppState.IsAuthenticated) { return } }
  Run-ChildWindow -ScriptPath "C:\IntuneTools\LicenseWindow.ps1" -ExportedFunction "Show-LicenseWindow" -Args @{}
})

$btnClose.Add_Click({ $form.Close() })
[void]$form.ShowDialog()
