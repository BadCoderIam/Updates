# YubiKeyWindow_styled2_fixed.ps1
<#
UI: Dark themed YubiKey / Cert Console
- Single Scan (Graph or Exchange via radio buttons)
- Stop
- Scan FIDO2 (separate list)
- Notify Selected
- Open CSV, Sign in to Graph, Connect EXO
PowerShell 5.1 compatible (no ternary operator)
#>

Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase

# ---------- XAML ----------
$x = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="YubiKey / Cert Console" Height="720" Width="1000" WindowStartupLocation="CenterScreen"
        Background="#121212" Foreground="#E5E5E5">
  <Window.Resources>
    <!-- Colors -->
    <SolidColorBrush x:Key="BgDark" Color="#121212"/>
    <SolidColorBrush x:Key="PanelDark" Color="#1C1C1C"/>
    <SolidColorBrush x:Key="BorderDark" Color="#2A2A2A"/>
    <SolidColorBrush x:Key="TextLight" Color="#E5E5E5"/>
    <SolidColorBrush x:Key="TextDim" Color="#B8B8B8"/>
    <SolidColorBrush x:Key="AccentGreen" Color="#29CC61"/>
    <SolidColorBrush x:Key="RowAlt" Color="#181818"/>
    <SolidColorBrush x:Key="RowBase" Color="#141414"/>
    <Style x:Key="RoundedBtn" TargetType="Button">
      <Setter Property="Background" Value="#232323"/>
      <Setter Property="Foreground" Value="{StaticResource TextLight}"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderDark}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="8,6"/>
      <Setter Property="Margin" Value="8,8,8,8"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="{TemplateBinding BorderThickness}"
                    CornerRadius="10">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter Property="Background" Value="#2A2A2A"/>
              </Trigger>
              <Trigger Property="IsPressed" Value="True">
                <Setter Property="Background" Value="#333333"/>
                <Setter Property="BorderBrush" Value="{StaticResource AccentGreen}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter Property="Foreground" Value="#666"/>
                <Setter Property="Background" Value="#1A1A1A"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <!-- DataGrid styling -->
    <Style TargetType="{x:Type DataGrid}">
      <Setter Property="Background" Value="{StaticResource PanelDark}"/>
      <Setter Property="Foreground" Value="{StaticResource TextLight}"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderDark}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="RowBackground" Value="{StaticResource RowBase}"/>
      <Setter Property="AlternatingRowBackground" Value="{StaticResource RowAlt}"/>
      <Setter Property="HorizontalGridLinesBrush" Value="#2B2B2B"/>
      <Setter Property="VerticalGridLinesBrush" Value="#2B2B2B"/>
      <Setter Property="SelectionUnit" Value="FullRow"/>
      <Setter Property="CanUserAddRows" Value="False"/>
      <Setter Property="CanUserDeleteRows" Value="False"/>
      <Setter Property="IsReadOnly" Value="False"/>
    </Style>
    <Style TargetType="{x:Type DataGridColumnHeader}">
      <Setter Property="Background" Value="#1E1E1E"/>
      <Setter Property="Foreground" Value="{StaticResource TextLight}"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderDark}"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
    </Style>
    <Style TargetType="{x:Type DataGridRow}">
      <Setter Property="SnapsToDevicePixels" Value="True"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="DataGridRow">
            <Border x:Name="RowBorder" BorderThickness="0" Background="{TemplateBinding Background}">
              <SelectiveScrollingGrid>
                <SelectiveScrollingGrid.ColumnDefinitions>
                  <ColumnDefinition Width="Auto"/>
                  <ColumnDefinition Width="*"/>
                </SelectiveScrollingGrid.ColumnDefinitions>
                <SelectiveScrollingGrid.RowDefinitions>
                  <RowDefinition Height="*"/>
                  <RowDefinition Height="Auto"/>
                </SelectiveScrollingGrid.RowDefinitions>
                <DataGridCellsPresenter Grid.Column="1"/>
                <DataGridDetailsPresenter Grid.Column="1" Grid.Row="1"/>
              </SelectiveScrollingGrid>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsSelected" Value="True">
                <Setter TargetName="RowBorder" Property="Background" Value="#112A1C"/> <!-- dark green tint -->
                <Setter Property="Foreground" Value="{StaticResource TextLight}"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>

  <DockPanel LastChildFill="True" Margin="10">
    <!-- Top controls -->
    <StackPanel DockPanel.Dock="Top" Orientation="Vertical">
      <Grid Margin="0,0,0,6">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="260"/>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="80"/>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="80"/>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="80"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <TextBlock Text="Group:" VerticalAlignment="Center" Margin="0,0,8,0"/>
        <TextBox x:Name="TxtGroup" Grid.Column="1" Text="DYN-Activeusers" Background="#1C1C1C" BorderBrush="#2A2A2A" Foreground="#E5E5E5"/>

        <TextBlock Grid.Column="2" Text="Days:" VerticalAlignment="Center" Margin="16,0,8,0"/>
        <TextBox x:Name="TxtDays" Grid.Column="3" Text="30" Background="#1C1C1C" BorderBrush="#2A2A2A" Foreground="#E5E5E5"/>

        <StackPanel Grid.Column="4" Orientation="Horizontal" VerticalAlignment="Center" Margin="16,0,8,0">
          <TextBlock Text="Backend:" VerticalAlignment="Center" Margin="0,0,8,0"/>
        </StackPanel>
        <StackPanel Grid.Column="5" Orientation="Horizontal" VerticalAlignment="Center">
          <RadioButton x:Name="RdoGraph" Content="Graph" IsChecked="True" Margin="0,0,12,0" Foreground="#E5E5E5"/>
          <RadioButton x:Name="RdoExo"   Content="Exchange" Foreground="#E5E5E5"/>
        </StackPanel>
      </Grid>

      <StackPanel Orientation="Horizontal">
        <Button x:Name="BtnScan" Content="Scan" Style="{StaticResource RoundedBtn}"/>
        <Button x:Name="BtnStop" Content="Stop" Style="{StaticResource RoundedBtn}"/>
        <Button x:Name="BtnScanFido" Content="Scan FIDO2" Style="{StaticResource RoundedBtn}"/>
        <Button x:Name="BtnNotify" Content="Notify Selected" Style="{StaticResource RoundedBtn}"/>
        <Button x:Name="BtnOpenCsv" Content="Open CSV" Style="{StaticResource RoundedBtn}"/>
        <Button x:Name="BtnGraph" Content="Sign in to Graph" Style="{StaticResource RoundedBtn}"/>
        <Button x:Name="BtnExo" Content="Connect EXO" Style="{StaticResource RoundedBtn}"/>
      </StackPanel>
    </StackPanel>

    <!-- Results grid -->
    <DataGrid x:Name="GridResults" AutoGenerateColumns="False" Margin="0,8,0,6" AlternationCount="2">
      <DataGrid.Columns>
    <DataGridCheckBoxColumn Header="Selected" Binding="{Binding Selected}" Width="70" />
    <DataGridTextColumn Header="DisplayName" Binding="{Binding DisplayName}" Width="*" />
    <DataGridTextColumn Header="UPN"         Binding="{Binding UPN}"         Width="*" />
    <DataGridTextColumn Header="Thumbprint"  Binding="{Binding Thumbprint}"  Width="220" />
    <!-- 👇 rename + format -->
    <DataGridTextColumn Header="Expires"
                        Binding="{Binding NotAfter, StringFormat=\{0:yyyy-MM-dd\}}"
                        Width="120" />
    <DataGridTextColumn Header="DaysLeft"    Binding="{Binding DaysLeft}"    Width="90" />
    <DataGridTextColumn Header="HasFido2"    Binding="{Binding HasFido2}"    Width="90" />
    <DataGridTextColumn Header="Source"      Binding="{Binding Source}"      Width="100" />
  </DataGrid.Columns>
</DataGrid>

    <!-- Status log -->
    <TextBox x:Name="TxtStatus" DockPanel.Dock="Bottom" Height="140" Margin="0,6,0,0" IsReadOnly="True"
             VerticalScrollBarVisibility="Auto" Background="#151515" Foreground="#CFCFCF" BorderBrush="#2A2A2A"
             Text="Ready."/>
  </DockPanel>
</Window>
"@

# ---------- Build WPF ----------
$reader = New-Object System.Xml.XmlNodeReader ([xml]$x)
$win = [Windows.Markup.XamlReader]::Load($reader)

# Controls
$TxtGroup    = $win.FindName('TxtGroup')
$TxtDays     = $win.FindName('TxtDays')
$RdoGraph    = $win.FindName('RdoGraph')
$RdoExo      = $win.FindName('RdoExo')
$BtnScan     = $win.FindName('BtnScan')
$BtnStop     = $win.FindName('BtnStop')
$BtnScanFido = $win.FindName('BtnScanFido')
$BtnNotify   = $win.FindName('BtnNotify')
$BtnOpenCsv  = $win.FindName('BtnOpenCsv')
$BtnGraph    = $win.FindName('BtnGraph')
$BtnExo      = $win.FindName('BtnExo')
$GridResults = $win.FindName('GridResults')
$TxtStatus   = $win.FindName('TxtStatus')

# Data source
$Rows = New-Object 'System.Collections.ObjectModel.ObservableCollection[object]'
$GridResults.ItemsSource = $Rows

# ---------- Helpers ----------
function Log([string]$msg) {
  if ($TxtStatus) {
    $TxtStatus.AppendText((Get-Date).ToString('HH:mm:ss ') + $msg + "`r`n")
    $TxtStatus.ScrollToEnd()
  } else { Write-Host $msg }
}
function Set-Status([string]$msg) { Log $msg }

function Ensure-GraphModules {
  try {
    Import-Module Microsoft.Graph.Users,Microsoft.Graph.Groups,Microsoft.Graph.Users.Actions -ErrorAction Stop
    return $true
  } catch {
    Log "Graph modules missing. Install-Module Microsoft.Graph -Scope CurrentUser"
    return $false
  }
}
function Ensure-GraphSignedIn {
  try {
    $ctx = Get-MgContext
    if ($null -eq $ctx -or -not $ctx.Account) { return $false }
    return $true
  } catch { return $false }
}
function Connect-GraphIfNeeded {
  if (-not (Ensure-GraphModules)) { return $false }
  if (Ensure-GraphSignedIn) { return $true }
  try {
    Connect-MgGraph -Scopes @('User.Read.All','Group.Read.All','UserAuthenticationMethod.Read.All','Mail.Send') -NoWelcome | Out-Null
    return $true
  } catch {
    Log ("Graph sign-in failed: {0}" -f $_.Exception.Message)
    return $false
  }
}

function Ensure-Exo {
  try {
    Import-Module ExchangeOnlineManagement -ErrorAction Stop
  } catch {
    Log "Installing ExchangeOnlineManagement..."
    try { Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force -ErrorAction Stop } catch {}
    try { Import-Module ExchangeOnlineManagement -ErrorAction Stop } catch {
      Log "Failed to import ExchangeOnlineManagement."; return $false
    }
  }
  return $true
}

function Clear-Rows { $Rows.Clear() }

function Add-Row([bool]$sel,[string]$display,[string]$upn,[string]$thumb,[Nullable[DateTime]]$notAfter,[Nullable[int]]$days,[Nullable[bool]]$hasFido,[string]$source) {
  $obj = New-Object psobject -Property @{
    Selected    = $sel
    DisplayName = $display
    UPN         = $upn
    Thumbprint  = $thumb
    NotAfter    = $notAfter
    DaysLeft    = $days
    HasFido2    = $hasFido
    Source      = $source
  }
  $Rows.Add($obj) | Out-Null
}

function Get-CertBytes($raw) {
  if ($raw -is [byte[]]) { return $raw }
  return [Convert]::FromBase64String([string]$raw)
}

# ---------- Scans ----------
$script:CancelScan = $false

function Resolve-GroupId([string]$name) {
  $grp = Get-MgGroup -Filter "displayName eq '$name'" -ConsistencyLevel eventual -Count c -ErrorAction Stop
  if ($grp -and $grp.Count -gt 0) { return $grp[0].Id }
  return $null
}

function Get-GroupUsers([string]$gid) {
  Get-MgGroupMember -GroupId $gid -All | Where-Object { $_.'@odata.type' -eq '#microsoft.graph.user' }
}

function Scan-GraphCerts([string]$group,[int]$days,[bool]$fidoAlso) {
  if (-not (Connect-GraphIfNeeded)) { return }
  $gid = Resolve-GroupId $group
  if (-not $gid) { Log "Group '$group' not found."; return }
  $users = Get-GroupUsers $gid
  $count = 0

  Clear-Rows
  foreach ($u in $users) {
    if ($script:CancelScan) { Log "Scan cancelled."; break }
    $count++
    try {
      $user = Get-MgUser -UserId $u.Id -Property id,displayName,userPrincipalName,userCertificate,userSmimeCertificate
      $certs = @()
      if ($user.UserCertificate) { $certs += $user.UserCertificate }
      if ($user.UserSmimeCertificate) { $certs += $user.UserSmimeCertificate }

      if ($certs.Count -eq 0) {
        Add-Row $false $user.DisplayName $user.UserPrincipalName $null $null $null $null 'Graph'
      } else {
        foreach ($raw in $certs) {
          try {
            $bytes = Get-CertBytes $raw
            $x = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList (, $bytes)
            $daysLeft = [int]([math]::Round(($x.NotAfter - (Get-Date)).TotalDays,0))
            Add-Row $false $user.DisplayName $user.UserPrincipalName $x.Thumbprint $x.NotAfter $daysLeft $null 'Graph'
          } catch {
            Add-Row $false $user.DisplayName $user.UserPrincipalName $null $null $null $null 'ParseError'
          }
        }
      }

      if ($fidoAlso) {
        try {
          $fido = Get-MgUserAuthenticationFido2Method -UserId $u.Id -ErrorAction SilentlyContinue
          $has = $false
          if ($fido) { $has = $true }
          # Update last row(s) matching user to set HasFido2 if null
          for ($i = $Rows.Count-1; $i -ge 0; $i--) {
            if ($Rows[$i].UPN -eq $user.UserPrincipalName -and $null -eq $Rows[$i].HasFido2) {
              $Rows[$i].HasFido2 = $has
            }
          }
        } catch { }
      }

      if (($count % 10) -eq 0) { Set-Status ("Processed {0} users..." -f $count) }
    } catch {
      Add-Row $false $u.DisplayName $u.UserPrincipalName $null $null $null $null 'FetchError'
    }
  }
  Set-Status ("Done. Processed {0} users." -f $count)
}

function Scan-ExoCerts([string]$group,[int]$days) {
  if (-not (Ensure-Exo)) { return }
  try { Connect-ExchangeOnline -ShowBanner:$false -ErrorAction Stop | Out-Null } catch { Log "EXO connect failed: $($_.Exception.Message)"; return }

  if (-not (Connect-GraphIfNeeded)) { return } # Use Graph to resolve group membership
  $gid = Resolve-GroupId $group
  if (-not $gid) { Log "Group '$group' not found."; return }
  $users = Get-GroupUsers $gid
  $count = 0

  Clear-Rows
  foreach ($u in $users) {
    if ($script:CancelScan) { Log "Scan cancelled."; break }
    $count++
    try {
      $recip = Get-EXORecipient -Identity $u.UserPrincipalName -PropertySets All -ErrorAction Stop
      $thumb = $null; $notAfter = $null; $daysLeft = $null
      # Best effort: EXO doesn't always store S/MIME certs; keep placeholders
      Add-Row $false $u.DisplayName $u.UserPrincipalName $thumb $notAfter $daysLeft $null 'Exchange'
    } catch {
      Add-Row $false $u.DisplayName $u.UserPrincipalName $null $null $null $null 'FetchError'
    }
    if (($count % 10) -eq 0) { Set-Status ("Processed {0} users..." -f $count) }
  }
  Set-Status ("Done. Processed {0} users." -f $count)
}

function Scan-FidoOnly([string]$group) {
  if (-not (Connect-GraphIfNeeded)) { return }
  $gid = Resolve-GroupId $group
  if (-not $gid) { Log "Group '$group' not found."; return }
  $users = Get-GroupUsers $gid
  Clear-Rows
  $n = 0
  foreach ($u in $users) {
    if ($script:CancelScan) { Log "Scan cancelled."; break }
    $n++
    try {
      $fido = Get-MgUserAuthenticationFido2Method -UserId $u.Id -ErrorAction SilentlyContinue
      $has = $false
      if ($fido) { $has = $true }
      Add-Row $false $u.DisplayName $u.UserPrincipalName $null $null $null $has 'FIDO2'
    } catch {
      Add-Row $false $u.DisplayName $u.UserPrincipalName $null $null $null $null 'FetchError'
    }
    if (($n % 10) -eq 0) { Set-Status ("Processed {0} users..." -f $n) }
  }
  Set-Status ("Done. Processed {0} users." -f $n)
}

# ---------- Notify ----------
function Notify-Selected([int]$days) {
  if (-not (Connect-GraphIfNeeded)) { return }
  $sel = @($Rows | Where-Object { $_.Selected -and $_.UPN -and $_.DaysLeft -ne $null -and $_.DaysLeft -le $days })
  if ($sel.Count -eq 0) { Log "No selected rows with expiring certs."; return }

  foreach ($r in $sel) {
    try {
      $body = @"
Hello $($r.DisplayName),

Our records show your email certificate is expiring on $($r.NotAfter.ToShortDateString()).
Please renew it as soon as possible to avoid mail encryption/signature issues.

Thanks,
IT Support
"@
      $message = @{
        Message = @{
          Subject = "Your certificate is expiring soon"
          Body    = @{
            ContentType = "Text"
            Content     = $body
          }
          ToRecipients = @(@{ EmailAddress = @{ Address = $r.UPN } })
        }
        SaveToSentItems = "true"
      }
      Send-MgUserMail -UserId 'me' -BodyParameter $message -ErrorAction Stop
      Log ("Notified {0}" -f $r.UPN)
    }
    catch {
      Log ("Notify failed for {0}: {1}" -f $r.UPN, $_.Exception.Message)
    }
  }
}

# ---------- Wire buttons ----------
$BtnGraph.Add_Click({
  if (Connect-GraphIfNeeded) { Log "Graph ready." } else { Log "Graph sign-in failed." }
})
$BtnExo.Add_Click({
  if (Ensure-Exo) {
    try { Connect-ExchangeOnline -ShowBanner:$false -ErrorAction Stop | Out-Null; Log "EXO connected." }
    catch { Log ("EXO connect failed: {0}" -f $_.Exception.Message) }
  }
})
$BtnOpenCsv.Add_Click({
  $root = Join-Path $env:APPDATA 'IntuneTools'
  $csv = Join-Path $root 'GroupCertExpiry.csv'
  if (-not (Test-Path $csv)) { Log "No CSV yet at $csv"; return }
  Start-Process explorer.exe $csv | Out-Null
})
$BtnStop.Add_Click({ $script:CancelScan = $true; Log "Stop requested." })

$BtnScan.Add_Click({
  $group = $TxtGroup.Text
  $days  = 30
  try { [int]::TryParse($TxtDays.Text, [ref]$days) | Out-Null } catch {}
  $useGraph = $true
  if ($RdoExo.IsChecked) { $useGraph = $false }
  $script:CancelScan = $false
  $backendName = if ($useGraph) { 'Graph' } else { 'Exchange' }
  Set-Status ("Scanning group '{0}' (backend: {1})..." -f $group, $backendName)
  try {
    if ($useGraph) { Scan-GraphCerts $group $days $false } else { Scan-ExoCerts $group $days }
  } catch {
    Log ("Scan error: {0}" -f $_.Exception.Message)
  }
})

$BtnScanFido.Add_Click({
  $group = $TxtGroup.Text
  $script:CancelScan = $false
  Set-Status ("Scanning FIDO2 sign-in (group '{0}')..." -f $group)
  try { Scan-FidoOnly $group } catch { Log ("FIDO scan error: {0}" -f $_.Exception.Message) }
})

$BtnNotify.Add_Click({
  $days  = 30
  try { [int]::TryParse($TxtDays.Text, [ref]$days) | Out-Null } catch {}
  Notify-Selected $days
})

# ---------- Show ----------
$win.ShowDialog() | Out-Null
