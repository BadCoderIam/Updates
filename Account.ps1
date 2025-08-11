# AccountCreatorWPF.ps1
# Functionized, clean UI, ready to be called from your main menu
# Reuses $AppState.Environment, uses existing Graph token if present

param() # safe to dot-source

# --- Modules (minimal) ---
Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
Import-Module Microsoft.Graph.Users          -ErrorAction Stop
Import-Module Microsoft.Graph.Groups         -ErrorAction Stop
Import-Module Microsoft.Graph.Identity.DirectoryManagement -ErrorAction SilentlyContinue

Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase



function Show-AccountCreatorWindow {
param([Parameter(Mandatory)][hashtable]$AppState)

# ---------- Defaults / settings ----------
$envName            = if ($AppState.Environment) { $AppState.Environment } else { "USGov" }
$SettingsPath       = Join-Path $env:APPDATA "IntuneTools\AccountCreator.settings.json"
$ManagerSnapPath    = Join-Path $env:APPDATA "IntuneTools\ManagerSnapshot.json"
$PendingPath        = "C:\IntuneTools\PendingActivations.json"
$EnableScriptPath   = "C:\IntuneTools\EnablePendingUsers.ps1"
$EnableTaskName     = "IntuneTools_EnablePendingUsers"
$DefaultDomain      = "mycompany.com"
$DefaultCompanyName = "My company"
$DefaultMgrGroup    = "DYN-ActiveUsers"
$DefaultPhotoPath   = "C:\IntuneTools\android-chrome-512x512.png"

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
  $dir = Split-Path $SettingsPath -Parent
  if (-not (Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }
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

# ---------- Helpers ----------
function Ensure-Dir($p){ if (-not (Test-Path $p)) { New-Item $p -ItemType Directory -Force | Out-Null } }
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
param(
  [string]`$PendingPath = '$PendingPath',
  [string]`$Environment = '$envName'
)
Import-Module Microsoft.Graph.Authentication
Import-Module Microsoft.Graph.Users
try { `$ctx = Get-MgContext -ErrorAction Stop } catch { `$ctx = `$null }
if (-not `$ctx -or -not `$ctx.Account) {
  Connect-MgGraph -Environment `$Environment -Scopes 'User.ReadWrite.All' -NoWelcome | Out-Null
}
if (-not (Test-Path `$PendingPath)) { return }
try { `$items = Get-Content -Path `$PendingPath -Raw | ConvertFrom-Json } catch { return }
if (-not `$items) { return }
`$now = [DateTime]::UtcNow
`$rem = @()
foreach (`$it in `$items) {
  try {
    if ([DateTime]::Parse(`$it.startUtc) -le `$now) { Update-MgUser -UserId `$it.userId -AccountEnabled `$true | Out-Null }
    else { `$rem += `$it }
  } catch { `$rem += `$it }
}
(`$rem | ConvertTo-Json) | Set-Content -Path `$PendingPath -Encoding UTF8
"@ | Set-Content $EnableScriptPath -Encoding UTF8
}
function Ensure-EnableTask {
  Ensure-EnableScript
  $act = New-ScheduledTaskAction -Execute "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$EnableScriptPath`""
  $trg = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
  $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  if (Get-ScheduledTask -TaskName $EnableTaskName -ErrorAction SilentlyContinue) {
    Set-ScheduledTask -TaskName $EnableTaskName -Action $act -Trigger $trg -Settings $set | Out-Null
  } else {
    Register-ScheduledTask -TaskName $EnableTaskName -Action $act -Trigger $trg -Settings $set -Description "Enable new hire accounts (IntuneTools)" | Out-Null
  }
}
function LoadBitmapNoLock([string]$path){
  if (-not (Test-Path $path)) { return $null }
  $bi = New-Object System.Windows.Media.Imaging.BitmapImage
  $bi.BeginInit()
  $bi.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $bi.UriSource = New-Object System.Uri($path)
  $bi.EndInit(); $bi.Freeze(); return $bi
}
function ReadManagerSnapshot {
  if (Test-Path $ManagerSnapPath) { try { Get-Content $ManagerSnapPath -Raw | ConvertFrom-Json } catch { @() } } else { @() }
}
function WriteManagerSnapshot($items){
  Ensure-Dir (Split-Path $ManagerSnapPath -Parent)
  ($items | ConvertTo-Json -Depth 4) | Set-Content $ManagerSnapPath -Encoding UTF8
}
function EnsureManagerSnapshot([string]$groupName){
  $items = ReadManagerSnapshot
  if ($items -and $items.Count) { return $items }
  Ensure-Graph
  $g = Get-MgGroup -Filter "DisplayName eq '$groupName'"
  if (-not $g) { throw "Group not found: $groupName" }
  $members = Get-MgGroupMember -GroupId $g.Id -All | Where-Object { $_.AdditionalProperties['@odata.type'] -eq '#microsoft.graph.user' }
  $list = foreach($m in $members){
    [pscustomobject]@{
      displayName = [string]$m.AdditionalProperties['displayName']
      upn         = [string]$m.AdditionalProperties['userPrincipalName']
    }
  }
  WriteManagerSnapshot $list
  return $list
}
function New-ComplexPassword([int]$len=16){
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}?"
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] ($len); $rng.GetBytes($bytes)
  ($bytes | ForEach-Object { $chars[ $_ % $chars.Length ] }) -join ''
}

# ---------- XAML (cleaned) ----------
$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Account Creator" Height="640" Width="840" WindowStartupLocation="CenterScreen">
  <Window.Resources>
    <Style TargetType="TextBox"><Setter Property="Margin" Value="0,0,0,6"/></Style>
    <Style TargetType="PasswordBox"><Setter Property="Margin" Value="0,0,0,6"/></Style>
    <Style TargetType="TextBlock"><Setter Property="Margin" Value="0,0,6,6"/></Style>
    <Style TargetType="Button"><Setter Property="Margin" Value="0,0,8,0"/></Style>
    <Style TargetType="CheckBox"><Setter Property="Margin" Value="0,0,8,6"/></Style>
    <Style TargetType="DatePicker"><Setter Property="Margin" Value="0,0,8,6"/></Style>
  </Window.Resources>
  <DockPanel LastChildFill="True" Margin="12">
    <Grid DockPanel.Dock="Bottom" Margin="0,8,0,0">
      <Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
      <TextBox x:Name="LogBox" Grid.Column="0" Height="80" TextWrapping="Wrap" AcceptsReturn="True" IsReadOnly="True" VerticalScrollBarVisibility="Auto"/>
      <Button x:Name="CreateBtn" Grid.Column="1" Width="120" Height="32" Margin="8,0,8,0">Create account</Button>
      <Button x:Name="CloseBtn" Grid.Column="2" Width="80" Height="32">Close</Button>
    </Grid>

    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
      </Grid.RowDefinitions>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="140"/><ColumnDefinition Width="*"/>
        <ColumnDefinition Width="140"/><ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>

      <!-- Names -->
      <TextBlock Grid.Row="0" Grid.Column="0" VerticalAlignment="Center">First name:</TextBlock>
      <TextBox   x:Name="First" Grid.Row="0" Grid.Column="1"/>
      <TextBlock Grid.Row="0" Grid.Column="2" VerticalAlignment="Center">Last name:</TextBlock>
      <TextBox   x:Name="Last"  Grid.Row="0" Grid.Column="3"/>

      <!-- Display -->
      <TextBlock Grid.Row="1" Grid.Column="0" VerticalAlignment="Center">Display name:</TextBlock>
      <TextBox x:Name="Display" Grid.Row="1" Grid.Column="1" Grid.ColumnSpan="3"/>

      <!-- Photo -->
      <TextBlock Grid.Row="2" Grid.Column="0" VerticalAlignment="Center">Profile image:</TextBlock>
      <StackPanel Grid.Row="2" Grid.Column="1" Grid.ColumnSpan="3" Orientation="Horizontal">
        <Image x:Name="Photo" Width="72" Height="72" Stretch="UniformToFill" Margin="0,0,10,6"/>
        <TextBox x:Name="PhotoPath" Width="520"/>
        <Button x:Name="BrowsePhoto" Width="90">Browse…</Button>
      </StackPanel>

      <!-- UPN -->
      <TextBlock Grid.Row="3" Grid.Column="0" VerticalAlignment="Center">UPN (email):</TextBlock>
      <TextBox x:Name="UPN" Grid.Row="3" Grid.Column="1" Grid.ColumnSpan="3"/>

      <!-- Password / Usage -->
      <TextBlock Grid.Row="4" Grid.Column="0" VerticalAlignment="Center">Temp password:</TextBlock>
      <StackPanel Grid.Row="4" Grid.Column="1" Orientation="Horizontal">
        <PasswordBox x:Name="Pwd" Width="240"/>
        <Button x:Name="ShowPwd" Width="70">Show</Button>
        <Button x:Name="GenPwd" Width="90">Generate</Button>
      </StackPanel>
      <TextBlock Grid.Row="4" Grid.Column="2" VerticalAlignment="Center">Usage location:</TextBlock>
      <TextBox x:Name="Usage" Grid.Row="4" Grid.Column="3" Width="60" Text="US"/>

      <!-- Job/Dept -->
      <TextBlock Grid.Row="5" Grid.Column="0" VerticalAlignment="Center">Job title:</TextBlock>
      <TextBox x:Name="Job" Grid.Row="5" Grid.Column="1"/>
      <TextBlock Grid.Row="5" Grid.Column="2" VerticalAlignment="Center">Department:</TextBlock>
      <TextBox x:Name="Dept" Grid.Row="5" Grid.Column="3"/>

      <!-- Office/Mobile -->
      <TextBlock Grid.Row="6" Grid.Column="0" VerticalAlignment="Center">Office location:</TextBlock>
      <TextBox x:Name="Office" Grid.Row="6" Grid.Column="1"/>
      <TextBlock Grid.Row="6" Grid.Column="2" VerticalAlignment="Center">Mobile phone:</TextBlock>
      <TextBox x:Name="Mobile" Grid.Row="6" Grid.Column="3"/>

      <!-- Company/Domain -->
      <TextBlock Grid.Row="7" Grid.Column="0" VerticalAlignment="Center">Company name:</TextBlock>
      <TextBox x:Name="Company" Grid.Row="7" Grid.Column="1"/>
      <TextBlock Grid.Row="7" Grid.Column="2" VerticalAlignment="Center">Domain:</TextBlock>
      <TextBox x:Name="Domain" Grid.Row="7" Grid.Column="3"/>

      <!-- Start date -->
      <CheckBox x:Name="AutoEnable" Grid.Row="8" Grid.Column="0" Grid.ColumnSpan="2" IsChecked="True">Enable automatically at start date/time:</CheckBox>
      <DatePicker x:Name="StartDate" Grid.Row="8" Grid.Column="2"/>
      <TextBox x:Name="StartTime" Grid.Row="8" Grid.Column="3" Text="08:00"/>

      <!-- Manager -->
      <TextBlock Grid.Row="9" Grid.Column="0" VerticalAlignment="Top" Margin="0,6,6,0">Manager group:</TextBlock>
      <StackPanel Grid.Row="9" Grid.Column="1" Orientation="Horizontal" Margin="0,6,0,0">
        <TextBox x:Name="MgrGroup" Width="260"/>
        <Button x:Name="PickMgr" Width="120" Margin="8,0,0,0">Pick manager…</Button>
      </StackPanel>
      <TextBlock Grid.Row="9" Grid.Column="2" VerticalAlignment="Top" Margin="0,6,6,0">Manager UPN:</TextBlock>
      <TextBox x:Name="MgrUpn" Grid.Row="9" Grid.Column="3" Margin="0,6,0,0"/>
    </Grid>
  </DockPanel>
</Window>
"@

# ---------- Build window ----------
$reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
$win = [Windows.Markup.XamlReader]::Load($reader)

$First=$win.FindName('First'); $Last=$win.FindName('Last'); $Display=$win.FindName('Display')
$Photo=$win.FindName('Photo'); $PhotoPath=$win.FindName('PhotoPath'); $BrowsePhoto=$win.FindName('BrowsePhoto')
$UPN=$win.FindName('UPN'); $Pwd=$win.FindName('Pwd'); $ShowPwd=$win.FindName('ShowPwd'); $GenPwd=$win.FindName('GenPwd')
$Usage=$win.FindName('Usage'); $Job=$win.FindName('Job'); $Dept=$win.FindName('Dept'); $Office=$win.FindName('Office'); $Mobile=$win.FindName('Mobile')
$Company=$win.FindName('Company'); $DomainTb=$win.FindName('Domain')
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

# Behaviors
function Refresh-Ids { $ids = Build-Ids $First.Text $Last.Text $DomainTb.Text; $Display.Text=$ids.Display; $UPN.Text=$ids.UPN }
$First.Add_TextChanged({ Refresh-Ids }); $Last.Add_TextChanged({ Refresh-Ids }); $DomainTb.Add_TextChanged({ Refresh-Ids })

$BrowsePhoto.Add_Click({
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
    $dlg.Title="Pick Manager"; $dlg.Width=560; $dlg.Height=520; $dlg.WindowStartupLocation='CenterOwner'; $dlg.Owner=$win
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

# Create
$CreateBtn.Add_Click({
  try {
    if ([string]::IsNullOrWhiteSpace($First.Text) -or [string]::IsNullOrWhiteSpace($Last.Text)) { [System.Windows.MessageBox]::Show("Enter first and last name."); return }
    if ([string]::IsNullOrWhiteSpace($UPN.Text)) { [System.Windows.MessageBox]::Show("UPN is empty."); return }

    Ensure-Graph

    # UPN uniqueness
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

    Log "Creating user $upn (disabled)…"
    $new = New-MgUser @body
    $newId = $new.Id
    Log "✅ Created: $($new.DisplayName)"

    # Manager
    if ($MgrUpn.Text) {
      try { $mgr=Get-MgUser -UserId $MgrUpn.Text; $ref="https://graph.microsoft.com/v1.0/directoryObjects/$($mgr.Id)"; Set-MgUserManagerByRef -UserId $newId -RefUri $ref; Log "👔 Manager set: $($mgr.DisplayName)" } catch { Log "⚠️ Manager set failed: $($_.Exception.Message)" }
    }

    # Photo
    if (Test-Path $PhotoPath.Text) {
      try { Set-MgUserPhotoContent -UserId $newId -InFile $PhotoPath.Text; Log "🖼 Profile photo applied" } catch { Log "⚠️ Photo failed: $($_.Exception.Message)" }
    } else { Log "⚠️ Photo path not found" }

    # Auto-enable
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
} # end function

# --- Auto-launch when run directly (not dot-sourced) ---
if ($MyInvocation.InvocationName -ne '.') {
  if ([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    Start-Process powershell -ArgumentList @(
      '-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',"`"$PSCommandPath`""
    ) | Out-Null
    return
  }
  $AppState = [ordered]@{ Environment = 'USGov'; IsAuthenticated = $false }
  Show-AccountCreatorWindow -AppState $AppState
}

