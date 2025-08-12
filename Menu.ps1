# --- Resolve ToolsRoot so it works from PS1 or packaged EXE (no IncludeFiles needed) ---
param(
  [string]$Environment = 'USGov',
  [string]$ToolsRoot   = 'C:\IntuneTools'
)

function Get-ExecutableDirectory {
    try {
        $procPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
        $exeName  = [System.IO.Path]::GetFileName($procPath).ToLowerInvariant()

        if ($exeName -in @('powershell.exe','pwsh.exe','powershell_ise.exe')) {
            # Running as a .ps1 → use this script's folder
            if ($script:PSScriptRoot -and $script:PSScriptRoot.Trim()) {
                return $script:PSScriptRoot
            } elseif ($PSCommandPath -and $PSCommandPath.Trim()) {
                return (Split-Path -Parent $PSCommandPath)
            } else {
                return (Get-Location).Path
            }
        } else {
            # Running as packaged EXE → use the EXE's folder
            return (Split-Path -Parent $procPath)
        }
    } catch {
        return (Get-Location).Path
    }
}

if (-not $ToolsRoot -or [string]::IsNullOrWhiteSpace($ToolsRoot)) {
    $ToolsRoot = Get-ExecutableDirectory
}
Set-Location -Path $ToolsRoot

# Tool paths (loaded from the same folder as the PS1/EXE)
$AccountCreatorPath = Join-Path $ToolsRoot 'AccountCreatorWPF.ps1'
$PhotoToolPath      = Join-Path $ToolsRoot 'PhotoWindow.ps1'
$AuditToolPath      = Join-Path $ToolsRoot 'Audit.ps1'
$EnableScriptPath   = Join-Path $ToolsRoot 'EnablePendingUsers.ps1'


# Set default window size for WPF
Add-Type -AssemblyName PresentationFramework



# ----- Silent STA relaunch -----
if ($MyInvocation.InvocationName -ne '.') {
  if ($psise -ne $null -or [Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
      '-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',"`"$PSCommandPath`"",
      '-Environment', $Environment, '-ToolsRoot', $ToolsRoot
    ) | Out-Null
    return
  }
}



# ----- Paths -----
$AccountCreatorPath = Join-Path $ToolsRoot 'AccountCreatorWPF.ps1'
$PhotoToolPath      = Join-Path $ToolsRoot 'PhotoWindow.ps1'
$AuditToolPath      = Join-Path $ToolsRoot 'Audit.ps1'
$EnableScriptPath   = Join-Path $ToolsRoot 'EnablePendingUsers.ps1'
$PendingPath        = Join-Path $ToolsRoot 'PendingActivations.json'

$AppDataRoot   = Join-Path $env:APPDATA 'IntuneTools'
$SettingsPath  = Join-Path $AppDataRoot 'MainMenu.settings.json'

# ----- WPF -----
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase

$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Intune Tools — Main Menu (USGov)"
        Height="780" Width="1180"
        MinHeight="720" MinWidth="1100"
        SizeToContent="Manual"
        WindowStartupLocation="CenterScreen"
        Background="#1E1E1E" FontFamily="Segoe UI">
  <Window.Resources>
    <SolidColorBrush x:Key="Bg"     Color="#1E1E1E"/>
    <SolidColorBrush x:Key="Card"   Color="#232323"/>
    <SolidColorBrush x:Key="Border" Color="#33FFFFFF"/>
    <SolidColorBrush x:Key="Fg"     Color="#F2F2F2"/>
    <SolidColorBrush x:Key="Sub"    Color="#CCFFFFFF"/>
    <SolidColorBrush x:Key="RowAlt" Color="#2B2B2B"/>

    <Style TargetType="TextBlock">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="FontSize" Value="14"/>
    </Style>
    <Style TargetType="Button">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource Card}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Height" Value="40"/>
      <Setter Property="Margin" Value="10"/>
      <Setter Property="Padding" Value="16,8"/>
      <Setter Property="FontSize" Value="14"/>
    </Style>
    <Style TargetType="GroupBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Background" Value="{StaticResource Card}"/>
      <Setter Property="Padding" Value="10"/>
      <Setter Property="Margin" Value="0,0,0,12"/>
      <Setter Property="FontSize" Value="15"/>
    </Style>

    <!-- Dark ListView styling -->
    <Style TargetType="ListView">
      <Setter Property="Background" Value="{StaticResource Card}"/>
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
    </Style>
    <Style TargetType="GridViewColumnHeader">
      <Setter Property="Background" Value="{StaticResource RowAlt}"/>
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
    </Style>
    <Style TargetType="ListViewItem">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource Card}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Padding" Value="4"/>
      <Style.Triggers>
        <Trigger Property="IsMouseOver" Value="True">
          <Setter Property="Background" Value="{StaticResource RowAlt}"/>
        </Trigger>
        <Trigger Property="IsSelected" Value="True">
          <Setter Property="Background" Value="#3A6DF0"/>
        </Trigger>
      </Style.Triggers>
    </Style>
  </Window.Resources>

  <DockPanel LastChildFill="True" Margin="14">
    <!-- Footer -->
    <StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,12,0,0">
      <Button x:Name="BtnClose" Content="Close"/>
    </StackPanel>

    <!-- Status -->
    <Border DockPanel.Dock="Bottom" Background="{StaticResource Card}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1" Padding="8" Margin="0,12,0,0" Height="160">
      <Grid>
        <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition/></Grid.RowDefinitions>
        <TextBlock x:Name="LblStatus" Grid.Row="0" Text="Status: Initializing…" Foreground="{StaticResource Sub}" Margin="2,0,0,6"/>
        <TextBox x:Name="LogBox" Grid.Row="1" Background="{StaticResource Card}" Foreground="{StaticResource Fg}"
                 BorderThickness="0" IsReadOnly="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto"/>
      </Grid>
    </Border>

    <!-- Body -->
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
      </Grid.RowDefinitions>
      <TextBlock x:Name="LblWelcome" Grid.Row="0" Text="Welcome" FontSize="18" Margin="2,0,0,12"/>

      <Grid Grid.Row="1">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="12"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <!-- Left column -->
        <StackPanel Grid.Column="0">
          <GroupBox Header="User &amp; Onboarding">
            <UniformGrid Columns="2" Rows="3" Margin="4">
              <Button x:Name="BtnAccountCreator" Content="Account Creator" Width="200" IsEnabled="False"/>
              <Button x:Name="BtnUpdatePhotos"   Content="Update Photos"   Width="200" IsEnabled="False"/>
              <Button x:Name="BtnAudit"          Content="Audit"           Width="200" IsEnabled="False"/>
              <Button x:Name="BtnOutlook"        Content="Outlook"         Width="200" IsEnabled="False"/>
              <Button x:Name="BtnLicense"        Content="License check"   Width="200" IsEnabled="False"/>
            </UniformGrid>
          </GroupBox>

          <GroupBox Header="Environment">
            <StackPanel>
              <TextBlock x:Name="LblAuth" Text="Not signed in" Margin="4,0,0,6"/>
              <WrapPanel>
                <Button x:Name="BtnAuth"    Content="Authenticate" Width="200"/>
                <Button x:Name="BtnSignOut" Content="Sign out" Width="120" Margin="10,0,0,0" IsEnabled="False"/>
              </WrapPanel>
            </StackPanel>
          </GroupBox>
        </StackPanel>

        <!-- Right column: Setup with module grid -->
        <GroupBox Header="Setup" Grid.Column="2">
          <Grid>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
              <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <TextBlock Grid.Row="0"
              Text="On launch, required modules and scripts are verified and installed as needed."
              Margin="0,0,0,6"/>

            <WrapPanel Grid.Row="1" Margin="0,0,0,6">
              <Button x:Name="BtnRepair" Content="Run repair / reinstall" Width="220"/>
              <Button x:Name="BtnInstallSelected" Content="Install selected" Width="160" IsEnabled="False"/>
              <Button x:Name="BtnOpenTools" Content="Open tools folder" Width="160"/>
            </WrapPanel>

            <ListView x:Name="ModList" Grid.Row="2" Margin="0,6,0,6"
                      AlternationCount="2" Height="320">
              <ListView.ItemContainerStyle>
                <Style TargetType="{x:Type ListViewItem}">
                  <Setter Property="Foreground" Value="{StaticResource Fg}"/>
                  <Setter Property="Background" Value="{StaticResource Card}"/>
                  <Style.Triggers>
                    <Trigger Property="ItemsControl.AlternationIndex" Value="1">
                      <Setter Property="Background" Value="{StaticResource RowAlt}"/>
                    </Trigger>
                  </Style.Triggers>
                </Style>
              </ListView.ItemContainerStyle>
              <ListView.View>
                <GridView>
                  <GridViewColumn Header="Module"    DisplayMemberBinding="{Binding Name}"              Width="320"/>
                  <GridViewColumn Header="Status"    DisplayMemberBinding="{Binding Status}"            Width="170"/>
                  <GridViewColumn Header="Installed" DisplayMemberBinding="{Binding InstalledVersion}"  Width="150"/>
                  <GridViewColumn Header="Latest"    DisplayMemberBinding="{Binding LatestVersion}"     Width="150"/>
                  <GridViewColumn Header="Action"    DisplayMemberBinding="{Binding Action}"            Width="220"/>
                </GridView>
              </ListView.View>
            </ListView>

            <StackPanel Grid.Row="3" Orientation="Horizontal">
              <ProgressBar x:Name="SetupBar" Height="10" Minimum="0" Maximum="100" Width="420"/>
              <TextBlock   x:Name="SetupMsg" Margin="8,0,0,0" VerticalAlignment="Center" Foreground="{StaticResource Sub}"/>
            </StackPanel>
          </Grid>
        </GroupBox>
      </Grid>
    </Grid>
  </DockPanel>
</Window>
'@

function New-XamlWindow([string]$x){
  try {
    $sr = New-Object System.IO.StringReader($x)
    $xr = [System.Xml.XmlReader]::Create($sr)
    return [Windows.Markup.XamlReader]::Load($xr)
  } catch {
    $dump = Join-Path $env:TEMP 'MainMenu_xaml_error.xaml'
    $x | Set-Content $dump -Encoding UTF8
    throw "XAML parse error: $($_.Exception.Message)`nDumped to: $dump"
  }
}

$win = New-XamlWindow $xaml
$win.SizeToContent = 'Manual'   # make sure we control size
$win.Width  = 1180
$win.Height = 780
$win.WindowStartupLocation = 'CenterScreen'


# ----- Controls -----
$BtnClose          = $win.FindName('BtnClose')
$BtnAuth           = $win.FindName('BtnAuth')
$BtnSignOut        = $win.FindName('BtnSignOut')
$LblAuth           = $win.FindName('LblAuth')
$LblWelcome        = $win.FindName('LblWelcome')

$BtnAccountCreator = $win.FindName('BtnAccountCreator')
$BtnUpdatePhotos   = $win.FindName('BtnUpdatePhotos')
$BtnUpdatePhotos.IsEnabled = $true  # force enable for testing
$BtnAudit          = $win.FindName('BtnAudit')
$BtnOutlook        = $win.FindName('BtnOutlook')
$BtnLicense        = $win.FindName('BtnLicense')

$BtnRepair         = $win.FindName('BtnRepair')
$BtnInstallSelected= $win.FindName('BtnInstallSelected')
$BtnOpenTools      = $win.FindName('BtnOpenTools')
$LblStatus         = $win.FindName('LblStatus')
$LogBox            = $win.FindName('LogBox')

$ModList  = $win.FindName('ModList')
$SetupBar = $win.FindName('SetupBar')
$SetupMsg = $win.FindName('SetupMsg')

# ----- Helpers -----
function Ensure-Dir($p){ if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
function Log([string]$m){ $LogBox.AppendText(("{0} {1}`r`n" -f (Get-Date).ToString("HH:mm:ss"), $m)); $LogBox.ScrollToEnd() }
function SetStatus([string]$s){ $LblStatus.Text = "Status: $s" }
function UI-Setup([int]$pct,[string]$msg){ if($pct -lt 0){$pct=0}elseif($pct -gt 100){$pct=100}; $SetupBar.Value=$pct; $SetupMsg.Text=$msg }

# Win11 titlebar tweaks
try {
  Add-Type -Namespace Win32 -Name DwmApi -MemberDefinition @"
using System; using System.Runtime.InteropServices;
public static class DwmApi {
  [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
}
"@ -ErrorAction Stop
  $h=(New-Object System.Windows.Interop.WindowInteropHelper($win)).Handle
  $dark=1; [Win32.DwmApi]::DwmSetWindowAttribute($h,20,[ref]$dark,4)|Out-Null
  $round=2;[Win32.DwmApi]::DwmSetWindowAttribute($h,33,[ref]$round,4)|Out-Null
  $back=2; [Win32.DwmApi]::DwmSetWindowAttribute($h,38,[ref]$back,4)|Out-Null
} catch {}

# ----- Settings (remember window size/pos) -----
$Defaults = @{ Width=1180; Height=780; Left=$null; Top=$null }
function Load-Settings {
  Ensure-Dir $AppDataRoot
  if (Test-Path $SettingsPath) { try { return (Get-Content $SettingsPath -Raw | ConvertFrom-Json) } catch { return $Defaults } }
  return $Defaults
}
function Save-Settings {
  $s = [ordered]@{
    Width=[int]$win.Width; Height=[int]$win.Height
    Left = if ($win.WindowState -eq 'Normal') { [int]$win.Left } else { $null }
    Top  = if ($win.WindowState -eq 'Normal') { [int]$win.Top }  else { $null }
  }
  $s | ConvertTo-Json | Set-Content $SettingsPath -Encoding UTF8
}
$set = Load-Settings
if ($set.Width -and $set.Height) { $win.Width=$set.Width; $win.Height=$set.Height }
if ($set.Left -ne $null -and $set.Top -ne $null) { $win.Left=$set.Left; $win.Top=$set.Top }
$win.Add_Closed({ Save-Settings })

# ----- Prereqs / Modules -----
$ModulesNeeded = @(
  @{ Name='Microsoft.Graph.Authentication' }
  @{ Name='Microsoft.Graph.Users' }
  @{ Name='Microsoft.Graph.Groups' }
)

function Ensure-PSGallery {
  $repo = Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue
  if (-not $repo) {
    Register-PSRepository -Default -ErrorAction SilentlyContinue
    $repo = Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue
  }
  if ($repo -and $repo.InstallationPolicy -ne 'Trusted') {
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
  }
}
function Get-LatestVersion($name){
  try { (Find-Module -Name $name -ErrorAction Stop).Version.ToString() } catch { '' }
}
function Refresh-ModuleGrid {
  $rows = New-Object System.Collections.ObjectModel.ObservableCollection[object]
  $i=0
  foreach ($m in $ModulesNeeded) {
    $i++; UI-Setup ([int]($i*20)) ("Checking {0}…" -f $m.Name)
    $have = Get-Module -ListAvailable -Name $m.Name -ErrorAction SilentlyContinue |
            Sort-Object Version -Descending | Select-Object -First 1
    $installedVer = if ($have) { $have.Version.ToString() } else { '' }
    $latestVer    = Get-LatestVersion -name $m.Name
    $status       = if ($installedVer) { 'Installed' } else { 'Not installed' }
    $action       = if (-not $installedVer) { 'Install required' }
                    elseif ($latestVer -and ($installedVer -ne $latestVer)) { "Update available → $latestVer" }
                    else { 'Up to date' }
    $rows.Add([pscustomobject]@{
      Name = $m.Name; Status=$status; InstalledVersion=$installedVer; LatestVersion=$latestVer; Action=$action
    })
  }
  $ModList.ItemsSource = $rows
  UI-Setup 100 'Ready'
  # Enable/disable "Install selected" based on selection
  $BtnInstallSelected.IsEnabled = $false
}
function Ensure-EnableScript {
  if (Test-Path $EnableScriptPath) { return }
@"
param([string]`$PendingPath='$PendingPath',[string]`$Environment='$Environment')
Import-Module Microsoft.Graph.Authentication
Import-Module Microsoft.Graph.Users
try { `$ctx = Get-MgContext -ErrorAction Stop } catch { `$ctx = `$null }
if (-not `$ctx -or -not `$ctx.Account) { Connect-MgGraph -Environment `$Environment -Scopes 'User.ReadWrite.All' -NoWelcome | Out-Null }
if (-not (Test-Path `$PendingPath)) { return }
try { `$items = Get-Content -Path `$PendingPath -Raw | ConvertFrom-Json } catch { return }
if (-not `$items) { return }
`$now = [DateTime]::UtcNow; `$rem = @()
foreach (`$it in `$items) {
  try { if ([DateTime]::Parse(`$it.startUtc) -le `$now) { Update-MgUser -UserId `$it.userId -AccountEnabled `$true | Out-Null } else { `$rem += `$it } }
  catch { `$rem += `$it }
}
(`$rem | ConvertTo-Json) | Set-Content -Path `$PendingPath -Encoding UTF8
"@ | Set-Content $EnableScriptPath -Encoding UTF8
  Log "EnablePendingUsers.ps1 OK"
}
function Install-Prereqs {
  SetStatus 'Checking prerequisites…'
  Ensure-Dir $ToolsRoot; Ensure-Dir $AppDataRoot
  Refresh-ModuleGrid
  Ensure-PSGallery

  $rows = @($ModList.ItemsSource)
  $n = [Math]::Max(1,$rows.Count)
  $k = 0
  foreach ($row in $rows) {
    $k++
    if ($row.Action -eq 'Up to date') { continue }
    UI-Setup ([int](20 + ($k*60/$n))) ("Installing/Updating {0}…" -f $row.Name)
    Log ("Installing/Updating: {0}" -f $row.Name)
    try {
      Install-Module $row.Name -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
      Log ("OK: {0}" -f $row.Name)
    } catch {
      Log ("⚠️ {0} failed: {1}" -f $row.Name, $_.Exception.Message)
    }
  }
  try { Ensure-EnableScript } catch { Log "⚠️ Enable script write failed: $($_.Exception.Message)" }

  UI-Setup 90 'Re-checking…'
  Refresh-ModuleGrid
  SetStatus 'Ready'
  Log "Done."
}

# Single-row installer (button + double-click)
function Install-SelectedModule {
  $sel = $ModList.SelectedItem
  if (-not $sel) { return }
  if ($sel.Action -eq 'Up to date') { [System.Windows.MessageBox]::Show('Selected module is already up to date.'); return }
  SetStatus ("Installing {0}…" -f $sel.Name)
  UI-Setup 30 ("Installing {0}…" -f $sel.Name)
  try {
    Install-Module $sel.Name -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
    Log ("OK: {0}" -f $sel.Name)
  } catch {
    Log ("⚠️ {0} failed: {1}" -f $sel.Name, $_.Exception.Message)
  }
  UI-Setup 80 'Refreshing…'
  Refresh-ModuleGrid
  SetStatus 'Ready'
}

# Selection changed -> toggle button enabled
$ModList.Add_SelectionChanged({
  $sel = $ModList.SelectedItem
  $BtnInstallSelected.IsEnabled = $false
  if ($sel -and $sel.Action -ne 'Up to date') { $BtnInstallSelected.IsEnabled = $true }
})
$BtnInstallSelected.Add_Click({ Install-SelectedModule })
$ModList.Add_MouseDoubleClick({ Install-SelectedModule })

# ----- Auth & Welcome -----
function Get-WindowsDisplayName {
  try {
    # Try Win32_ComputerSystem username (domain\user) -> resolve to display
    $u = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $simple = $u.Split('\')[-1]
    # Best-effort prettify
    return ($simple.Substring(0,1).ToUpper() + $simple.Substring(1).ToLower())
  } catch { return $env:USERNAME }
}
function Set-WelcomeText([string]$name){
  if ([string]::IsNullOrWhiteSpace($name)) { $LblWelcome.Text = "Welcome" }
  else { $LblWelcome.Text = "Welcome, $name" }
}
function Set-ButtonsEnabled([bool]$enabled){
  $BtnAccountCreator.IsEnabled = $enabled
  $BtnUpdatePhotos.IsEnabled = $true  # force enabled for testing
  $BtnAudit.IsEnabled          = $enabled
  $BtnOutlook.IsEnabled        = $enabled
  $BtnLicense.IsEnabled        = $enabled
  $BtnSignOut.IsEnabled        = $enabled
}
function Refresh-AuthState {
  $fallback = Get-WindowsDisplayName
  try { $ctx = Get-MgContext -ErrorAction Stop } catch { $ctx = $null }
  if ($ctx -and $ctx.Account) {
    # Try Graph "me" for GivenName
    try {
      Import-Module Microsoft.Graph.Users -ErrorAction SilentlyContinue
      $me = Get-MgUser -UserId 'me' -Property GivenName,DisplayName -ErrorAction SilentlyContinue
      $first = if ($me.GivenName) { $me.GivenName } elseif ($me.DisplayName) { $me.DisplayName.Split(' ')[0] } else { $fallback }
      Set-WelcomeText $first
    } catch { Set-WelcomeText $fallback }
    $LblAuth.Text = "Signed in: $($ctx.Account) • $($ctx.Environment)"
    Set-ButtonsEnabled $true
  } else {
    Set-WelcomeText $fallback
    $LblAuth.Text = "Not signed in"
    Set-ButtonsEnabled $false
  }
}

# ----- Tool launch helper -----
function Launch-Tool([string]$toolPath, [object]$extraArgs) {
  if (-not (Test-Path $toolPath)) { UI 0 "Tool not found: $toolPath"; return }

  # Normalize extraArgs to an array of strings
  $argsList = @()
  if ($null -ne $extraArgs) {
    if ($extraArgs -is [System.Array]) {
      $argsList = @($extraArgs)
    } else {
      $argsList = @("$extraArgs")
    }
  }

  # Base args
  $psArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File', $toolPath)

  # Filter out null/empty
  $psArgs = $psArgs + ($argsList | Where-Object { $_ -ne $null -and "$_" -ne '' })

  # Quote each arg that has spaces; escape embedded quotes
  $quoted = foreach ($a in $psArgs) {
    $s = "$a".Replace('"','`"')
    if ($s -match '\s') { '"{0}"' -f $s } else { $s }
  }

  # Windows PowerShell Start-Process wants a single string for -ArgumentList
  $argString = ($quoted -join ' ')

  try {
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList $argString | Out-Null
  } catch {
    UI 0 "Failed to start: $toolPath`nArgs: $argString`n$($_.Exception.Message)"
  }
}
  Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    '-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',"`"$path`"",$args
  ) | Out-Null

# ----- Wire buttons -----
$BtnClose.Add_Click({ $win.Close() })
$BtnOpenTools.Add_Click({ Ensure-Dir $ToolsRoot; Start-Process explorer.exe $ToolsRoot })
$BtnRepair.Add_Click({ Install-Prereqs })

$BtnAuth.Add_Click({
  try {
    Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
    SetStatus 'Authenticating…'
    Connect-MgGraph -Environment $Environment -Scopes @(
      'User.Read','User.Read.All','Group.Read.All','User.ReadWrite.All','Directory.Read.All'
    ) -NoWelcome | Out-Null
    SetStatus 'Ready'
  } catch {
    SetStatus 'Auth error'
    Log "Auth error: $($_.Exception.Message)"
    [System.Windows.MessageBox]::Show($_.Exception.Message,'Auth error')
  }
  Refresh-AuthState
})
$BtnSignOut.Add_Click({ try { Disconnect-MgGraph -ErrorAction SilentlyContinue } catch {}; Refresh-AuthState })

$BtnAccountCreator.Add_Click({ Launch-Tool $AccountCreatorPath "-Environment $Environment" })
$BtnUpdatePhotos.Add_Click({ Launch-Tool $PhotoToolPath @() })
$BtnAudit.Add_Click({ Launch-Tool $AuditToolPath "-Environment $Environment" })
$BtnOutlook.Add_Click({ [System.Windows.MessageBox]::Show('Outlook tool not wired yet.') })
$BtnLicense.Add_Click({ [System.Windows.MessageBox]::Show('License check not wired yet.') })

# ----- First run -----
Install-Prereqs
Refresh-AuthState

# ----- Show -----
[void]$win.ShowDialog()
