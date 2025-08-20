# AccountCreatorWPF.ps1 — Stable WPF (dark), USGov, minimal styles (ISE-safe)

# Graph modules (minimal)
Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
Import-Module Microsoft.Graph.Users          -ErrorAction Stop
Import-Module Microsoft.Graph.Groups         -ErrorAction Stop

# WPF
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase

function Show-AccountCreatorWindow {
param([Parameter(Mandatory)][hashtable]$AppState)

  # ---------------- Defaults / Settings ----------------
  $envName            = if ($AppState.Environment) { $AppState.Environment } else { "USGov" }
  $SettingsPath       = Join-Path $env:APPDATA "IntuneTools\AccountCreator.settings.json"
  $ManagerSnapPath    = Join-Path $env:APPDATA "IntuneTools\ManagerSnapshot.json"
  $PendingPath        = "C:\IntuneTools\PendingActivations.json"
  $EnableScriptPath   = "C:\IntuneTools\EnablePendingUsers.ps1"
  $DefaultDomain      = "mycompany.com"
  $DefaultCompanyName = "My company"
  $DefaultMgrGroup    = "DYN-ActiveUsers"
  $DefaultPhotoPath   = "C:\IntuneTools\android-chrome-512x512.png"

  function Ensure-Dir($p){ if (-not (Test-Path $p)) { New-Item $p -ItemType Directory -Force | Out-Null } }
  function Load-Settings {
    if (Test-Path $SettingsPath) {
      try {
        $s = Get-Content $SettingsPath -Raw | ConvertFrom-Json
        if ($s.Domain)      { $script:DefaultDomain      = $s.Domain }
        if ($s.CompanyName) { $script:DefaultCompanyName = $s.CompanyName }
        if ($s.MgrGroup)    { $script:DefaultMgrGroup    = $s.MgrGroup }
        if ($s.PhotoPath)   { $script:DefaultPhotoPath   = $s.PhotoPath }
        if ($s.ManagerSnap) { $script:ManagerSnapPath    = $s.ManagerSnap }
        if ($s.PendingPath) { $script:PendingPath        = $s.PendingPath }
      } catch {}
    }
  }
  function Save-Settings {
    Ensure-Dir (Split-Path $SettingsPath -Parent)
    [pscustomobject]@{
      Domain      = $DefaultDomain
      CompanyName = $DefaultCompanyName
      MgrGroup    = $DefaultMgrGroup
      PhotoPath   = $DefaultPhotoPath
      ManagerSnap = $ManagerSnapPath
      PendingPath = $PendingPath
    } | ConvertTo-Json | Set-Content $SettingsPath -Encoding UTF8
  }
  Load-Settings

  # ---------------- Helpers ----------------
  function To-Proper([string]$s){ if([string]::IsNullOrWhiteSpace($s)){"".ToString()} else { $s=$s.Trim().ToLower(); $s.Substring(0,1).ToUpper()+$s.Substring(1) } }
  function Build-Ids($first,$last,$domain){
    $disp = (To-Proper $first) + " " + (To-Proper $last)
    $nick = (($first.Trim()+"."+$last.Trim()).ToLower() -replace '[^a-z0-9\.-]','')
    $upn  = if ($domain) { "$nick@$domain" } else { $nick }
    [pscustomobject]@{ Display=$disp; Nick=$nick; UPN=$upn }
  }
  function Ensure-Graph {
    $ctx = $null; try { $ctx = Get-MgContext -ErrorAction Stop } catch {}
    if ($ctx -and $ctx.Account -and $ctx.Environment -eq $envName) { return }
    Connect-MgGraph -Environment $envName -Scopes @("User.ReadWrite.All","Directory.Read.All","Group.Read.All") -NoWelcome | Out-Null
  }
  function Read-Pending { if (Test-Path $PendingPath){ try { Get-Content $PendingPath -Raw | ConvertFrom-Json } catch { @() } } else { @() } }
  function Write-Pending($arr){ Ensure-Dir (Split-Path $PendingPath -Parent); ($arr | ConvertTo-Json -Depth 6) | Set-Content $PendingPath -Encoding UTF8 }

  function Ensure-EnableScript {
    Ensure-Dir (Split-Path $EnableScriptPath -Parent)
@"
param([string]`$PendingPath='$PendingPath',[string]`$Environment='$envName')
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
  }
  function Ensure-EnableTask {
    Ensure-EnableScript
    $act = New-ScheduledTaskAction -Execute "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$EnableScriptPath`""
    $trg = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
    $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
    if (Get-ScheduledTask -TaskName "IntuneTools_EnablePendingUsers" -ErrorAction SilentlyContinue) {
      Set-ScheduledTask -TaskName "IntuneTools_EnablePendingUsers" -Action $act -Trigger $trg -Settings $set | Out-Null
    } else {
      Register-ScheduledTask -TaskName "IntuneTools_EnablePendingUsers" -Action $act -Trigger $trg -Settings $set -Description "Enable new hire accounts (IntuneTools)" | Out-Null
    }
  }
  function LoadBitmapNoLock([string]$path){
    if (-not (Test-Path $path)) { return $null }
    $bi = New-Object System.Windows.Media.Imaging.BitmapImage
    $bi.BeginInit(); $bi.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $bi.UriSource = New-Object System.Uri($path); $bi.EndInit(); $bi.Freeze(); return $bi
  }
  function ReadManagerSnapshot { if (Test-Path $ManagerSnapPath){ try { Get-Content $ManagerSnapPath -Raw | ConvertFrom-Json } catch { @() } } else { @() } }
  function WriteManagerSnapshot($items){ Ensure-Dir (Split-Path $ManagerSnapPath -Parent); ($items | ConvertTo-Json -Depth 4) | Set-Content $ManagerSnapPath -Encoding UTF8 }
  function EnsureManagerSnapshot([string]$groupName){
    $items = ReadManagerSnapshot; if ($items -and $items.Count) { return $items }
    Ensure-Graph
    $g = Get-MgGroup -Filter "DisplayName eq '$groupName'"; if (-not $g) { throw "Group not found: $groupName" }
    $members = Get-MgGroupMember -GroupId $g.Id -All | Where-Object { $_.AdditionalProperties['@odata.type'] -eq '#microsoft.graph.user' }
    $list = foreach($m in $members){ [pscustomobject]@{ displayName=[string]$m.AdditionalProperties['displayName']; upn=[string]$m.AdditionalProperties['userPrincipalName'] } }
    WriteManagerSnapshot $list; return $list
  }
  function New-ComplexPassword([int]$len=16){
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}?"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] ($len); $rng.GetBytes($bytes)
    ($bytes | ForEach-Object { $chars[ $_ % $chars.Length ] }) -join ''
  }

  # ---------------- Win11 Effects (safe) ----------------
  function Enable-Win11Effects {
    param([Parameter(Mandatory)]$Window,[switch]$Dark,[ValidateSet('None','Mica','Acrylic','Tabbed')][string]$Backdrop='Mica')
    try {
      Add-Type -Namespace Win32 -Name DwmApi -MemberDefinition @"
using System; using System.Runtime.InteropServices;
public static class DwmApi {
  [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
}
"@ -ErrorAction Stop
      $h = (New-Object System.Windows.Interop.WindowInteropHelper($Window)).Handle
      $DWMWA_USE_IMMERSIVE_DARK_MODE = 20; $isDark = [int]($Dark.IsPresent)
      [Win32.DwmApi]::DwmSetWindowAttribute($h, $DWMWA_USE_IMMERSIVE_DARK_MODE, [ref]$isDark, 4) | Out-Null
      $DWMWA_WINDOW_CORNER_PREFERENCE = 33; $DWMWCP_ROUND = 2
      [Win32.DwmApi]::DwmSetWindowAttribute($h, $DWMWA_WINDOW_CORNER_PREFERENCE, [ref]$DWMWCP_ROUND, 4) | Out-Null
      $DWMWA_SYSTEMBACKDROP_TYPE = 38
      $type = switch ($Backdrop) { 'None' {1} 'Mica' {2} 'Acrylic' {3} 'Tabbed' {4} }
      [Win32.DwmApi]::DwmSetWindowAttribute($h, $DWMWA_SYSTEMBACKDROP_TYPE, [ref]$type, 4) | Out-Null
    } catch { } # ignore on older OS/ISE
  }

  # --- XAML (dark, tidy layout) ---
$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Account Creator"
        Height="720" Width="1060" MinHeight="640" MinWidth="980"
        WindowStartupLocation="CenterScreen"
        FontFamily="Segoe UI"
        Background="#1E1E1E">
  <Window.Resources>
    <SolidColorBrush x:Key="BgWin"  Color="#1E1E1E"/>
    <SolidColorBrush x:Key="BgCard" Color="#232323"/>
    <SolidColorBrush x:Key="Fg"     Color="#F2F2F2"/>
    <SolidColorBrush x:Key="SubFg"  Color="#CCFFFFFF"/>
    <SolidColorBrush x:Key="Border" Color="#33FFFFFF"/>

    <Style TargetType="Label">
      <Setter Property="Foreground" Value="{StaticResource SubFg}"/>
      <Setter Property="HorizontalContentAlignment" Value="Right"/>
      <Setter Property="VerticalContentAlignment" Value="Center"/>
      <Setter Property="Margin" Value="0,0,10,12"/>
      <Setter Property="FontSize" Value="13"/>
    </Style>
    <Style TargetType="TextBlock">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="FontSize" Value="13"/>
    </Style>
    <Style TargetType="TextBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource BgCard}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="10,7"/>
      <Setter Property="Margin" Value="0,0,0,12"/>
      <Setter Property="FontSize" Value="13"/>
    </Style>
    <Style TargetType="PasswordBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource BgCard}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="10,7"/>
      <Setter Property="Margin" Value="0,0,0,12"/>
      <Setter Property="FontSize" Value="13"/>
    </Style>
    <Style TargetType="Button">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Background" Value="{StaticResource BgCard}"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="14,8"/>
      <Setter Property="Height" Value="36"/>
      <Setter Property="Margin" Value="10,0,0,0"/>
      <Setter Property="FontSize" Value="13"/>
    </Style>
    <Style TargetType="GroupBox">
      <Setter Property="Foreground" Value="{StaticResource Fg}"/>
      <Setter Property="Margin" Value="0,0,0,14"/>
      <Setter Property="Padding" Value="14"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Background" Value="{StaticResource BgCard}"/>
      <Setter Property="FontSize" Value="14"/>
    </Style>
  </Window.Resources>

  <DockPanel LastChildFill="True" Margin="14">
    <!-- Top bar -->
    <StackPanel DockPanel.Dock="Top" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,0,0,8">
      <Button x:Name="BtnConnect" Content="Connect"/>
    </StackPanel>

    <!-- Footer -->
    <StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,12,0,0">
      <Button x:Name="CreateBtn" Content="Create account"/>
      <Button x:Name="CloseBtn"  Content="Close"/>
    </StackPanel>

    <!-- Log -->
    <Border DockPanel.Dock="Bottom" Background="{StaticResource BgCard}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1" Padding="8" Margin="0,12,0,0" Height="130">
      <TextBox x:Name="LogBox" Background="{StaticResource BgCard}" Foreground="{StaticResource Fg}"
               BorderThickness="0" IsReadOnly="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" FontSize="12.5" MinWidth="220"/>
    </Border>

    <!-- Content -->
    <ScrollViewer VerticalScrollBarVisibility="Auto">
      <Grid>
        <Grid.ColumnDefinitions>
          <ColumnDefinition/>
          <ColumnDefinition Width="18"/>
          <ColumnDefinition/>
        </Grid.ColumnDefinitions>

        <!-- New hire -->
        <GroupBox Header="New hire details" Grid.Column="0">
          <Grid>
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="190"/>  <!-- label col -->
              <ColumnDefinition Width="*"/>   <!-- field col -->
              <ColumnDefinition Width="190"/>
              <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <Label    Grid.Row="0" Grid.Column="0" Content="First name:"/>
            <TextBox  x:Name="First" Grid.Row="0" Grid.Column="1"  MinWidth="220"/>
            <Label    Grid.Row="0" Grid.Column="2" Content="Last name:"/>
            <TextBox  x:Name="Last"  Grid.Row="0" Grid.Column="3"  MinWidth="220"/>

            <Label    Grid.Row="1" Grid.Column="0" Content="Display name:"/>
            <TextBox  x:Name="Display" Grid.Row="1" Grid.Column="1" Grid.ColumnSpan="3" MinWidth="220"/>

            <Label Grid.Row="2" Grid.Column="0" Content="Profile image:"/>
            <Grid  Grid.Row="2" Grid.Column="1" Grid.ColumnSpan="3">
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="96"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="120"/>
              </Grid.ColumnDefinitions>
              <Border Background="{StaticResource BgCard}" CornerRadius="6" Padding="6" BorderBrush="{StaticResource Border}" BorderThickness="1" Margin="0,0,10,0">
                <Image x:Name="Photo" Width="80" Height="80" Stretch="UniformToFill"/>
              </Border>
              <TextBox x:Name="PhotoPath" Grid.Column="1" MinWidth="220"/>
              <Button  x:Name="BrowsePhoto" Grid.Column="2" Content="Browse…"/>
            </Grid>

            <Label   Grid.Row="3" Grid.Column="0" Content="UPN (email):"/>
            <TextBox x:Name="UPN" Grid.Row="3" Grid.Column="1" Grid.ColumnSpan="3" MinWidth="220"/>

            <Label Grid.Row="4" Grid.Column="0" Content="Temp password:"/>
            <StackPanel Grid.Row="4" Grid.Column="1" Orientation="Horizontal">
              <PasswordBox x:Name="Pwd" Width="280"/>
              <Button x:Name="ShowPwd" Content="Show" Width="90"/>
              <Button x:Name="GenPwd"  Content="Generate" Width="110"/>
            </StackPanel>

            <Label   Grid.Row="4" Grid.Column="2" Content="Usage location:"/>
            <TextBox x:Name="Usage" Grid.Row="4" Grid.Column="3" Width="80" Text="US" MinWidth="220"/>

            <Label   Grid.Row="5" Grid.Column="0" Content="Job title:"/>
            <TextBox x:Name="Job" Grid.Row="5" Grid.Column="1" MinWidth="220"/>
            <Label   Grid.Row="5" Grid.Column="2" Content="Department:"/>
            <TextBox x:Name="Dept" Grid.Row="5" Grid.Column="3" MinWidth="220"/>

            <Label   Grid.Row="6" Grid.Column="0" Content="Office location:"/>
            <TextBox x:Name="Office" Grid.Row="6" Grid.Column="1" MinWidth="220"/>
            <Label   Grid.Row="6" Grid.Column="2" Content="Mobile phone:"/>
            <TextBox x:Name="Mobile" Grid.Row="6" Grid.Column="3" MinWidth="220"/>

            <Label   Grid.Row="7" Grid.Column="0" Content="Company name:"/>
            <TextBox x:Name="Company" Grid.Row="7" Grid.Column="1" MinWidth="220"/>
            <Label   Grid.Row="7" Grid.Column="2" Content="Domain:"/>
            <TextBox x:Name="Domain" Grid.Row="7" Grid.Column="3" MinWidth="220"/>
          </Grid>
        </GroupBox>

        <!-- Start & Manager -->
        <GroupBox Header="Start &amp; Manager" Grid.Column="2">
          <Grid>
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="190"/>
              <ColumnDefinition Width="*"/>
              <ColumnDefinition Width="160"/>
              <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
            </Grid.RowDefinitions>

            <CheckBox x:Name="AutoEnable" Grid.Row="0" Grid.Column="0" Grid.ColumnSpan="2" IsChecked="True"
                      Foreground="{StaticResource Fg}" Margin="0,0,0,12">
              Enable automatically at start date/time:
            </CheckBox>
            <DatePicker MinWidth="180" x:Name="StartDate" Grid.Row="0" Grid.Column="2"/>
            <TextBox   x:Name="StartTime" Grid.Row="0" Grid.Column="3" Text="08:00" Width="110" MinWidth="220"/>

            <Label Grid.Row="1" Grid.Column="0" Content="Manager group:"/>
            <StackPanel Grid.Row="1" Grid.Column="1" Orientation="Horizontal">
              <TextBox x:Name="MgrGroup" Width="320" MinWidth="220"/>
              <Button  x:Name="PickMgr" Width="140" Content="Pick manager…"/>
            </StackPanel>
            <Label   Grid.Row="1" Grid.Column="2" Content="Manager UPN:"/>
            <TextBox x:Name="MgrUpn" Grid.Row="1" Grid.Column="3" MinWidth="220"/>
          
            <!-- Device (Windows only) -->
            <Label Grid.Row="2" Grid.Column="0" Content="Device:"/>
            <StackPanel Grid.Row="2" Grid.Column="1" Grid.ColumnSpan="3" Margin="0,2,0,0">
              <StackPanel Orientation="Horizontal">
                <TextBox x:Name="DeviceSearch" Width="300" />
                <Button x:Name="BtnSearchDevice" Content="Search" Margin="8,0,0,0"/>
              </StackPanel>
              <ListBox x:Name="DeviceList" MinHeight="140"/>
            </StackPanel>

          </Grid>
        </GroupBox>
      </Grid>
    </ScrollViewer>
  </DockPanel>
</Window>
'@


  # ------------- Build window robustly (ISE friendly) -------------
  function New-XamlWindow([string]$x){
    try {
      $sr = New-Object System.IO.StringReader($x)
      $xr = [System.Xml.XmlReader]::Create($sr)
      return [Windows.Markup.XamlReader]::Load($xr)
    } catch {
      try { return [Windows.Markup.XamlReader]::Parse($x) }
      catch {
        $dump = Join-Path $env:TEMP 'AccountCreator_xaml_error.xaml'
        $x | Set-Content $dump -Encoding UTF8
        throw "XAML load error: $($_.Exception.Message)`nDumped to: $dump"
      }
    }
  }

  $win = New-XamlWindow $xaml
  Enable-Win11Effects -Window $win -Backdrop Mica -Dark | Out-Null

  # -------- Wire controls --------
  $First=$win.FindName('First'); $Last=$win.FindName('Last'); $Display=$win.FindName('Display')
  $Photo=$win.FindName('Photo'); $PhotoPath=$win.FindName('PhotoPath'); $BrowsePhoto=$win.FindName('BrowsePhoto')
  $UPN=$win.FindName('UPN'); $Pwd=$win.FindName('Pwd'); $ShowPwd=$win.FindName('ShowPwd'); $GenPwd=$win.FindName('GenPwd')
  $Usage=$win.FindName('Usage'); $Job=$win.FindName('Job'); $Dept=$win.FindName('Dept'); $Office=$win.FindName('Office'); $Mobile=$win.FindName('Mobile')
  $Company=$win.FindName('Company'); $DomainTb=$win.FindName('Domain')
  $BtnConnect=$win.FindName('BtnConnect'); $DeviceSearch=$win.FindName('DeviceSearch'); $BtnSearchDevice=$win.FindName('BtnSearchDevice'); $DeviceList=$win.FindName('DeviceList')
  $AutoEnable=$win.FindName('AutoEnable'); $StartDate=$win.FindName('StartDate'); $StartTime=$win.FindName('StartTime')
  $MgrGroup=$win.FindName('MgrGroup'); $PickMgr=$win.FindName('PickMgr'); $MgrUpn=$win.FindName('MgrUpn')
  $LogBox=$win.FindName('LogBox'); $CreateBtn=$win.FindName('CreateBtn'); $CloseBtn=$win.FindName('CloseBtn')

  # Defaults
  $DomainTb.Text = $DefaultDomain
  $Company.Text  = $DefaultCompanyName
  $MgrGroup.Text = $DefaultMgrGroup
  $PhotoPath.Text = $DefaultPhotoPath
  if (Test-Path $PhotoPath.Text) { $Photo.Source = LoadBitmapNoLock $PhotoPath.Text }
  $StartDate.SelectedDate = (Get-Date).Date.AddDays(1)

  function Log([string]$m){ $LogBox.AppendText(("{0} {1}`r`n" -f (Get-Date).ToString("HH:mm:ss"), $m)); $LogBox.ScrollToEnd() }
  function Refresh-Ids { $ids = Build-Ids $First.Text $Last.Text $DomainTb.Text; $Display.Text=$ids.Display; $UPN.Text=$ids.UPN }
  $First.Add_TextChanged({ Refresh-Ids }); $Last.Add_TextChanged({ Refresh-Ids }); $DomainTb.Add_TextChanged({ Refresh-Ids })

  $BrowsePhoto.Add_Click({
  # Connect (SSO) – uses your existing Ensure-Graph flow
  $BtnConnect.Add_Click({
    try {
      Ensure-Graph
      $ctx = Get-MgContext
      if ($ctx -and $ctx.Account) { Log ("Connected as {0}" -f $ctx.Account) } else { Log "Connected." }
    } catch { Log ("Connect failed: {0}" -f $_.Exception.Message) }
  })

  # Windows device search
  $BtnSearchDevice.Add_Click({
    try {
      Ensure-Graph
      $term = $DeviceSearch.Text
      if (-not $term) { Log "Enter device name or ID"; return }
      Log ("Searching Windows devices: {0}" -f $term)
      $DeviceList.Items.Clear()
      $base = 'https://graph.microsoft.com/beta'
      $uri = "$base/deviceManagement/managedDevices?$filter=(contains(deviceName,'$term') or contains(azureADDeviceId,'$term')) and operatingSystem eq 'Windows'&$select=id,deviceName,azureADDeviceId,operatingSystem"
      $resp = Invoke-MgGraphRequest -Method GET -Uri $uri
      foreach ($d in $resp.value) {
        $li = New-Object System.Windows.Controls.ListBoxItem
        $li.Content = "{0} ({1}) [{2}]" -f $d.deviceName, $d.operatingSystem, $d.azureADDeviceId
        $li.Tag = $d.id; [void]$DeviceList.Items.Add($li)
      }
      Log ("Found {0} Windows device(s)" -f $DeviceList.Items.Count)
    } catch { Log ("Device search failed: {0}" -f $_.Exception.Message) }
  })

    $dlg = New-Object Microsoft.Win32.OpenFileDialog
    $dlg.Filter = "Images|*.png;*.jpg;*.jpeg|All files|*.*"
    if ($dlg.ShowDialog()) { $PhotoPath.Text=$dlg.FileName; $Photo.Source = LoadBitmapNoLock $PhotoPath.Text; $script:DefaultPhotoPath=$PhotoPath.Text; Save-Settings }
  })
  $ShowPwd.Add_Click({
    if ($Pwd.Tag -eq 'shown') { $Pwd.Password = $Pwd.TagValue; $Pwd.Tag=$null; $Pwd.TagValue=$null; $ShowPwd.Content='Show' }
    else { $Pwd.TagValue = $Pwd.Password; $Pwd.Password=''; $Pwd.Tag='shown'; $ShowPwd.Content='Hide' }
  })
  $GenPwd.Add_Click({ $Pwd.Password = (New-ComplexPassword 16) })

  $PickMgr.Add_Click({
    try {
      $items = ReadManagerSnapshot
      if (-not $items -or $items.Count -eq 0) { Log "Building manager snapshot from group '$($MgrGroup.Text)'…"; $items = EnsureManagerSnapshot $MgrGroup.Text }
      if (-not $items -or $items.Count -eq 0) { [System.Windows.MessageBox]::Show("No managers found."); return }

      $dlg = New-Object System.Windows.Window
      $dlg.Title="Pick Manager"; $dlg.Width=560; $dlg.Height=520; $dlg.WindowStartupLocation='CenterOwner'; $dlg.Owner=$win; $dlg.Background=[Windows.Media.Brushes]::Black

      $grid = New-Object System.Windows.Controls.Grid
      $grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition))
      $grid.RowDefinitions.Add((New-Object System.Windows.Controls.RowDefinition)); $grid.RowDefinitions[1].Height='Auto'
      $lv = New-Object System.Windows.Controls.ListView; $lv.Margin='10'
      $view = New-Object System.Windows.Controls.GridView
      $c1 = New-Object System.Windows.Controls.GridViewColumn; $c1.Header='Display Name'; $c1.DisplayMemberBinding=(New-Object System.Windows.Data.Binding 'displayName'); $c1.Width=250
      $c2 = New-Object System.Windows.Controls.GridViewColumn; $c2.Header='UPN'; $c2.DisplayMemberBinding=(New-Object System.Windows.Data.Binding 'upn'); $c2.Width=260
      $view.Columns.Add($c1); $view.Columns.Add($c2); $lv.View=$view; $lv.ItemsSource=$items
      $buttons = New-Object System.Windows.Controls.StackPanel; $buttons.Orientation='Horizontal'; $buttons.HorizontalAlignment='Right'; $buttons.Margin='10'
      $ok = New-Object System.Windows.Controls.Button; $ok.Content='OK'; $ok.Width=80; $ok.Margin='0,0,8,0'
      $cx = New-Object System.Windows.Controls.Button; $cx.Content='Cancel'; $cx.Width=80
      $buttons.Children.Add($ok); $buttons.Children.Add($cx)
      [System.Windows.Controls.Grid]::SetRow($lv,0); [System.Windows.Controls.Grid]::SetRow($buttons,1)
      $grid.Children.Add($lv); $grid.Children.Add($buttons); $dlg.Content=$grid
      $ok.Add_Click({ if ($lv.SelectedItem){ $MgrUpn.Text=$lv.SelectedItem.upn; $dlg.DialogResult=$true } else { $dlg.DialogResult=$false } })
      $cx.Add_Click({ $dlg.DialogResult=$false })
      [void]$dlg.ShowDialog()
    } catch { [System.Windows.MessageBox]::Show($_.Exception.Message,"Manager picker") }
  })

  $CreateBtn.Add_Click({
    try {
      if ([string]::IsNullOrWhiteSpace($First.Text) -or [string]::IsNullOrWhiteSpace($Last.Text)) { [System.Windows.MessageBox]::Show("Enter first and last name."); return }
      if ([string]::IsNullOrWhiteSpace($UPN.Text)) { [System.Windows.MessageBox]::Show("UPN is empty."); return }
      Ensure-Graph

      # Ensure UPN uniqueness
      $nick = ($UPN.Text.Split('@')[0]); $domain=$DomainTb.Text; $base=$nick; $upn=$UPN.Text; $i=0
      while ($true) { $exists=$false; try{ $u=Get-MgUser -Filter "userPrincipalName eq '$upn'"; if($u){$exists=$true} }catch{}; if(-not $exists){break}; $i++; $nick="$base$i"; $upn="$base$i@$domain" }

      $pwd = if ($Pwd.Tag -eq 'shown') { $Pwd.TagValue } else { $Pwd.Password }
      if ([string]::IsNullOrWhiteSpace($pwd)) { [System.Windows.MessageBox]::Show("Password is empty."); return }

      $body = @{
        AccountEnabled   = $false
        DisplayName      = $Display.Text
        MailNickname     = $nick
        UserPrincipalName= $upn
        PasswordProfile  = @{ Password=$pwd; ForceChangePasswordNextSignIn=$true }
        UsageLocation    = $Usage.Text
        JobTitle         = $Job.Text
        Department       = $Dept.Text
        OfficeLocation   = $Office.Text
        MobilePhone      = $Mobile.Text
        CompanyName      = $Company.Text
      }

      $LogBox.Clear()
      Log "Creating user $upn (disabled)…"
      $new = New-MgUser @body
      $newId = $new.Id
      Log "✅ Created: $($new.DisplayName)"

      if ($MgrUpn.Text) {
        try { $mgr=Get-MgUser -UserId $MgrUpn.Text; $ref="https://graph.microsoft.com/v1.0/directoryObjects/$($mgr.Id)"; Set-MgUserManagerByRef -UserId $newId -RefUri $ref; Log "👔 Manager set: $($mgr.DisplayName)" } catch { Log "⚠️ Manager set failed: $($_.Exception.Message)" }
      }

      if (Test-Path $PhotoPath.Text) {
        try { Set-MgUserPhotoContent -UserId $newId -InFile $PhotoPath.Text; Log "🖼 Profile photo applied" } catch { Log "⚠️ Photo failed: $($_.Exception.Message)" }
      } else { Log "⚠️ Photo path not found" }

      if ($AutoEnable.IsChecked) {
        $date = $StartDate.SelectedDate; if (-not $date) { $date=(Get-Date).Date.AddDays(1) }
        $startLocal = Get-Date "$($date.ToString('yyyy-MM-dd')) $($StartTime.Text)"
        $startUtc   = $startLocal.ToUniversalTime().ToString('o')
        $pending = @(); $ex=Read-Pending; if($ex){$pending+=$ex}; $pending += [pscustomobject]@{ userId=$newId; upn=$upn; startUtc=$startUtc }
        Write-Pending $pending; Ensure-EnableTask
        Log ("🕒 Enable scheduled for {0} local ({1} UTC)" -f $startLocal.ToString('yyyy-MM-dd HH:mm'), $startUtc)
      }

      [System.Windows.MessageBox]::Show("User created.`nUPN: $upn","Success")
    } catch {
      Log "❌ Create failed: $($_.Exception.Message)"
      [System.Windows.MessageBox]::Show($_.Exception.Message,"Error")
    }
  })

  $CloseBtn.Add_Click({ Save-Settings; $win.Close() })

  [void]$win.ShowDialog()
}

# --- Auto-launch when run directly ---
if ($MyInvocation.InvocationName -ne '.') {
  $args = @('-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',"`"$PSCommandPath`"")
  if ($psise -ne $null -or [Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    Start-Process powershell -WindowStyle Hidden -ArgumentList $args | Out-Null
    return
  }
  $AppState = [ordered]@{ Environment = 'USGov'; IsAuthenticated = $false }
  Show-AccountCreatorWindow -AppState $AppState
}
