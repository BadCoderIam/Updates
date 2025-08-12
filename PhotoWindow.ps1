<# PhotoWindow.ps1 — Push profile photo to group (USGov-friendly)
    Primary: push chosen photo to ALL members of DYN-ActiveUsers
    Optional: when "Verify" is checked, download & compare and only push when needed
    Logs to status area, no popups. STA/WPF safe. PS5+.

    Requires:
      Microsoft.Graph.Authentication
      Microsoft.Graph.Users
      Microsoft.Graph.Groups
#>

[CmdletBinding()]
param(
  [string]$Environment = 'USGov',
  [string]$GroupName   = 'DYN-ActiveUsers',
  [string]$ToolsRoot   = ''
)

# ---------- Resolve working folder (PS1 or packaged EXE) ----------
function Get-ExecutableDirectory {
  try {
    $procPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $exeName  = [System.IO.Path]::GetFileName($procPath).ToLowerInvariant()
    if ($exeName -in @('powershell.exe','pwsh.exe','powershell_ise.exe')) {
      if ($script:PSScriptRoot -and $script:PSScriptRoot.Trim()) { return $script:PSScriptRoot }
      elseif ($PSCommandPath -and $PSCommandPath.Trim()) { return (Split-Path -Parent $PSCommandPath) }
      else { return (Get-Location).Path }
    } else { return (Split-Path -Parent $procPath) }
  } catch { return (Get-Location).Path }
}
if ([string]::IsNullOrWhiteSpace($ToolsRoot)) { $ToolsRoot = Get-ExecutableDirectory }
Set-Location -Path $ToolsRoot

# ---------- Modules ----------
Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
Import-Module Microsoft.Graph.Users          -ErrorAction Stop
Import-Module Microsoft.Graph.Groups         -ErrorAction Stop

# ---------- Auth ----------
function Ensure-Graph {
  try { $ctx = Get-MgContext -ErrorAction Stop } catch { $ctx = $null }
  if (-not $ctx -or -not $ctx.Account) {
    Connect-MgGraph -Environment $Environment -Scopes @('User.ReadWrite.All','Group.Read.All','GroupMember.Read.All') -NoWelcome | Out-Null
  }
}

# ---------- Snapshot helpers (optional) ----------
$SnapshotPath = Join-Path $ToolsRoot 'PhotoSnapshot.json'

function Load-Snapshot {
  if (Test-Path $SnapshotPath) {
    try { return (Get-Content -Raw -Path $SnapshotPath | ConvertFrom-Json) } catch { return [pscustomobject]@{} }
  }
  [pscustomobject]@{}
}

function Save-Snapshot([object]$obj) {
  $obj | ConvertTo-Json -Depth 6 | Set-Content -Path $SnapshotPath -Encoding UTF8
}

# ---------- File helpers ----------
function Get-MD5([string]$path){
  try { return (Get-FileHash -Path $path -Algorithm MD5).Hash } catch { return $null }
}

function Download-UserPhoto([string]$upn,[string]$outPath){
  try {
    $bytes = Get-MgUserPhotoContent -UserId $upn -ErrorAction Stop
    if ($bytes) {
      [IO.File]::WriteAllBytes($outPath, $bytes)
      return $true
    }
  } catch { }
  return $false
}

# ---------- UI ----------
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Update User Photos" Height="640" Width="940"
        WindowStartupLocation="CenterScreen" Background="#1E1E1E" FontFamily="Segoe UI">
  <Window.Resources>
    <SolidColorBrush x:Key="Card" Color="#232323"/>
    <SolidColorBrush x:Key="Border" Color="#33FFFFFF"/>
    <SolidColorBrush x:Key="Fg" Color="#F2F2F2"/>
    <Style TargetType="TextBlock"><Setter Property="Foreground" Value="{StaticResource Fg}"/></Style>
    <Style TargetType="GroupBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="Margin" Value="10"/>
    </Style>
    <Style TargetType="TextBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource Card}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
    </Style>
    <Style TargetType="Button">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource Card}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="Height" Value="34"/>
      <Setter Property="Margin" Value="6"/>
    </Style>
    <Style TargetType="CheckBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
    </Style>
  </Window.Resources>

  <Grid Margin="10">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>
    <Grid.ColumnDefinitions>
      <ColumnDefinition Width="2*"/>
      <ColumnDefinition Width="*"/>
    </Grid.ColumnDefinitions>

    <!-- Options -->
    <GroupBox Header="Options" Grid.Row="0" Grid.ColumnSpan="2">
      <Grid Margin="8">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="100"/>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>

        <TextBlock Grid.Row="0" Grid.Column="0" Text="Photo file:" Margin="0,6,8,0"/>
        <TextBox   x:Name="TxtPhoto" Grid.Row="0" Grid.Column="1" Margin="0,4,8,0"/>
        <Button    x:Name="BtnBrowse" Grid.Row="0" Grid.Column="2" Content="Browse…" Width="110"/>

        <StackPanel Grid.Row="1" Grid.Column="0" Grid.ColumnSpan="3" Orientation="Horizontal" Margin="0,6,0,0">
          <TextBlock Text="Group:" Margin="0,6,6,0"/>
          <TextBox x:Name="TxtGroup" Width="220" Text="DYN-ActiveUsers" Margin="0,4,16,0"/>
          <CheckBox x:Name="ChkVerify" Content="Verify current photos (download &amp; compare)" Margin="0,6,0,0"/>
        </StackPanel>
      </Grid>
    </GroupBox>

    <!-- Actions (left-side) -->
    <GroupBox Header="Actions" Grid.Row="1" Grid.Column="0">
      <StackPanel Margin="6">
        <Button x:Name="BtnPush" Content="Push Profile Photo to Group" Height="40" />
      </StackPanel>
    </GroupBox>

    <!-- Summary (right) -->
    <GroupBox Header="Summary" Grid.Row="1" Grid.Column="1">
      <Grid Margin="6">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <TextBlock x:Name="LblSnap" Grid.Row="0" Text="Snapshot: (none)"/>
        <TextBlock x:Name="LblLastPush" Grid.Row="1" Text="Last push: (none)" Margin="0,4,0,0"/>
        <TextBlock x:Name="LblGroupRes" Grid.Row="2" Text="" Margin="0,8,0,0"/>
      </Grid>
    </GroupBox>

    <!-- Status -->
    <Grid Grid.Row="2" Grid.ColumnSpan="2">
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="120"/>
      </Grid.RowDefinitions>
      <ProgressBar x:Name="Pb" Grid.Row="0" Height="14" Minimum="0" Maximum="100"/>
      <TextBox x:Name="LogBox" Grid.Row="1" IsReadOnly="True" VerticalScrollBarVisibility="Auto"/>
    </Grid>
  </Grid>
</Window>
"@

$sr = New-Object IO.StringReader($xaml.OuterXml)
$xr = [Xml.XmlReader]::Create($sr)
$win = [Windows.Markup.XamlReader]::Load($xr)

# Controls
$TxtPhoto  = $win.FindName('TxtPhoto')
$BtnBrowse = $win.FindName('BtnBrowse')
$TxtGroup  = $win.FindName('TxtGroup')
$ChkVerify = $win.FindName('ChkVerify')
$BtnPush   = $win.FindName('BtnPush')
$LblSnap   = $win.FindName('LblSnap')
$LblLast   = $win.FindName('LblLastPush')
$LblGroupR = $win.FindName('LblGroupRes')
$Pb        = $win.FindName('Pb')
$LogBox    = $win.FindName('LogBox')

# Window size (safe)
$win.SizeToContent = 'Manual'
$win.Width  = 940
$win.Height = 640
$win.WindowStartupLocation = 'CenterScreen'

# REPLACE your current UI() with this:
function UI([int]$pct,[string]$msg){
  if ($pct -ge 0) {
    $Pb.Value = [math]::Min(100,[math]::Max(0,$pct))
  }
  if ($msg) {
    $LogBox.AppendText(("{0} {1}`r`n" -f (Get-Date).ToString("HH:mm:ss"),$msg))
    $LogBox.ScrollToEnd()
  }
  # WPF-friendly yield
  $win.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::Background)
}


# Initial values
$TxtGroup.Text = $GroupName
if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
  $defaultPic = Join-Path $env:USERPROFILE 'Pictures\android-chrome-512x512.png'
  if (Test-Path $defaultPic) { $TxtPhoto.Text = $defaultPic }
}

# Load snapshot header
$Snap = Load-Snapshot
if ($Snap -and $Snap.lastPushUtc) { $LblLast.Text = "Last push: $($Snap.lastPushUtc)" }
else { $LblLast.Text = "Last push: (none)" }
if (Test-Path $SnapshotPath) { $LblSnap.Text = "Snapshot: $SnapshotPath" } else { $LblSnap.Text = "Snapshot: (none)" }

# Browse photo
$BtnBrowse.Add_Click({
  $dlg = New-Object Microsoft.Win32.OpenFileDialog
  $dlg.Filter = "Images (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg|All files (*.*)|*.*"
  if ($dlg.ShowDialog()) { $TxtPhoto.Text = $dlg.FileName }
})

# -------- Core job --------
$BtnPush.Add_Click({
  $grpName = $TxtGroup.Text.Trim()
  $verify  = $ChkVerify.IsChecked
  $photo   = $TxtPhoto.Text.Trim()

  # If photo path is empty or missing, prompt to choose
  if ([string]::IsNullOrWhiteSpace($photo) -or -not (Test-Path $photo)) {
    UI 0 "No photo selected. Please choose an image…"
    $dlg = New-Object Microsoft.Win32.OpenFileDialog
    $dlg.Filter = "Images (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg|All files (*.*)|*.*"
    if ($dlg.ShowDialog()) {
      $TxtPhoto.Text = $dlg.FileName
      $photo = $TxtPhoto.Text.Trim()
    }
  }

  if ([string]::IsNullOrWhiteSpace($photo) -or -not (Test-Path $photo)) {
    UI 0 "Photo not found or not selected. Aborting."
    return
  }

  try {
    UI 2 "Connecting to Graph ($Environment)…"
    Ensure-Graph
  } catch {
    UI 0 ("Auth failed: {0}" -f $_.Exception.Message)
    return
  }

  try {
    UI 6 "Resolving group '$grpName'…"
    $grp = Get-MgGroup -Filter "DisplayName eq '$grpName'"
    if (-not $grp) { UI 0 "Group not found: $grpName"; return }

    UI 10 "Enumerating members…"
    $members = Get-MgGroupMember -GroupId $grp.Id -All | Where-Object { $_.AdditionalProperties['@odata.type'] -eq '#microsoft.graph.user' }
  $upns = $members |
  ForEach-Object { [string]$_.AdditionalProperties['userPrincipalName'] } |
  Where-Object { $_ } |
  Sort-Object -Unique
    $total = [math]::Max(1,$upns.Count)
    $LblGroupR.Text = "Members: $total"

    $refHash = Get-MD5 $photo
    $tmpRoot = Join-Path $env:TEMP ("PhotoVerify_{0}" -f ([Guid]::NewGuid().ToString('N')))
    if ($verify) { New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null }

    $i=0; $applied=0; $skipped=0; $same=0; $errors=0
    foreach($u in $upns) {
      $i++; $pct = 10 + [int](($i/$total)*88)
      UI $pct "User $i/$total $u"

      $pushNeeded = $true
      if ($verify) {
        $tmp = Join-Path $tmpRoot ($u -replace '[^\w\.-]','_') + '.img'
        if (Download-UserPhoto -upn $u -outPath $tmp) {
          $curHash = Get-MD5 $tmp
          if ($curHash -and $curHash -eq $refHash) {
            $same++; $pushNeeded = $false
            UI -1 "  ⏭️  Same as reference (skip)"
          }
        }
      }

      if ($pushNeeded) {
        try {
          Set-MgUserPhotoContent -UserId $u -InFile $photo
          UI -1 "  ✅ Applied"
          $applied++
        } catch {
          UI -1 ("  ❌ Error: {0}" -f $_.Exception.Message)
          $errors++
        }
      } else { $skipped++ }
    }

    if ($verify -and (Test-Path $tmpRoot)) {
      Remove-Item -Path $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Update snapshot header (optional)
    $Snap = [pscustomobject]@{
      lastPushUtc = [DateTime]::UtcNow.ToString('u')
      group       = $grpName
      refHash     = $refHash
      count       = $total
    }
    Save-Snapshot $Snap
    $LblLast.Text = "Last push: $($Snap.lastPushUtc)"
    $LblSnap.Text = "Snapshot: $SnapshotPath"

    UI 100 ("Done. Applied={0} Skipped={1} Same={2} Errors={3}" -f $applied,$skipped,$same,$errors)
  } catch {
    UI $Pb.Value ("Stopped: {0}" -f $_.Exception.Message)
  }
})

[void]$win.ShowDialog()
