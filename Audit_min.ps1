# Audit_min.ps1 — Intune Audit (focused)
# Exports selected Intune sections to CSV using Microsoft Graph delegated SSO (no app registration).
# Sections: Device Configuration (classic), Settings Catalog, Endpoint Security (ASR-ish via intents).
# UI matches dark style used in Account tool (compact).

Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase

# ---------- Defaults & Graph context ----------
if (-not (Get-Variable -Name Environment -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace($Environment)) { $Environment = 'USGov' }
$AppDataRoot = Join-Path $env:APPDATA 'IntuneTools'
if (-not (Test-Path $AppDataRoot)) { New-Item -ItemType Directory -Path $AppDataRoot -Force | Out-Null }
$GraphContextPath = Join-Path $AppDataRoot 'mgcontext.json'
$ScopesWanted = @('DeviceManagementConfiguration.Read.All','DeviceManagementConfiguration.ReadWrite.All','DeviceManagementManagedDevices.Read.All','Directory.AccessAsUser.All','User.Read')

Import-Module Microsoft.Graph.Authentication -ErrorAction SilentlyContinue
try { if (Test-Path $GraphContextPath) { Import-MgContext -Path $GraphContextPath -ErrorAction SilentlyContinue | Out-Null } } catch {}

# ---------- XAML ----------
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Intune Audit (USGov) — Export (focused)" Width="980" Height="660"
        WindowStartupLocation="CenterScreen" Background="#111111" Foreground="#EFEFEF" FontFamily="Segoe UI" FontSize="13">
  <Window.Resources>
    <SolidColorBrush x:Key="PanelBrush"     Color="#1D1D1D"/>
    <SolidColorBrush x:Key="BorderBrush1"   Color="#353535"/>
    <Style TargetType="GroupBox">
      <Setter Property="Foreground" Value="#C8C8C8"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderBrush1}"/>
      <Setter Property="Background" Value="{StaticResource PanelBrush}"/>
      <Setter Property="Margin" Value="10"/>
      <Setter Property="Padding" Value="10"/>
    </Style>
    <Style TargetType="Button">
      <Setter Property="Foreground" Value="#EFEFEF"/>
      <Setter Property="Background" Value="{StaticResource PanelBrush}"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderBrush1}"/>
      <Setter Property="Padding" Value="10,7"/>
      <Setter Property="Margin" Value="6"/>
    </Style>
    <Style TargetType="TextBox">
      <Setter Property="Foreground" Value="#EFEFEF"/>
      <Setter Property="Background" Value="{StaticResource PanelBrush}"/>
      <Setter Property="BorderBrush" Value="{StaticResource BorderBrush1}"/>
      <Setter Property="Padding" Value="6,4"/>
      <Setter Property="Margin" Value="4"/>
    </Style>
    <Style TargetType="CheckBox">
      <Setter Property="Foreground" Value="#EFEFEF"/>
      <Setter Property="Margin" Value="6"/>
    </Style>
  </Window.Resources>

  <DockPanel LastChildFill="True" Margin="10">
    <!-- Top bar -->
    <StackPanel DockPanel.Dock="Top" Orientation="Horizontal" HorizontalAlignment="Right">
      <Button x:Name="BtnConnect" Content="Connect"/>
    </StackPanel>

    <Grid Margin="0,10,0,10">
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>

      <GroupBox Grid.Row="0" Header="Sections to Export">
        <UniformGrid Columns="2">
          <CheckBox x:Name="CbDeviceConfigs" IsChecked="True" Content="Legacy Device Configuration (profiles + metadata)"/>
          <CheckBox x:Name="CbSettingsCatalog" IsChecked="True" Content="Settings Catalog (configurationPolicies + metadata)"/>
          <CheckBox x:Name="CbEndpointASR" IsChecked="True" Content="Endpoint Security — Antivirus / ASR (intents)"/>
        </UniformGrid>
      </GroupBox>

      <GroupBox Grid.Row="1" Header="Options">
        <DockPanel>
          <Label Content="Output folder:" Margin="0,0,6,0"/>
          <TextBox x:Name="TxtOut" Text="C:\IntuneExports" MinWidth="520" />
          <Button x:Name="BtnBrowse" Content="Browse..." Width="100" Margin="8,0,0,0"/>
        </DockPanel>
      </GroupBox>

      <GroupBox Grid.Row="2" Header="Progress">
        <DockPanel>
          <StackPanel>
            <TextBlock x:Name="LblStatus" Text="Status: Idle" Margin="2"/>
            <ProgressBar x:Name="Bar" Height="12" Minimum="0" Maximum="100" Margin="2"/>
            <TextBox x:Name="Log" IsReadOnly="True" MinHeight="360" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto"/>
          </StackPanel>
        </DockPanel>
      </GroupBox>

      <DockPanel Grid.Row="3">
        <CheckBox x:Name="CbDryRun" Content="Dry-run (preview only; no changes)" IsChecked="True" DockPanel.Dock="Left"/>
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
          <Button x:Name="BtnStart" Content="Start" Width="110"/>
          <Button x:Name="BtnOpen" Content="Open folder" Width="110"/>
          <Button x:Name="BtnClose" Content="Close" Width="110"/>
        </StackPanel>
      </DockPanel>
    </Grid>
  </DockPanel>
</Window>
"@

# ---------- Build window ----------
$reader = New-Object System.Xml.XmlNodeReader($xaml)
$win = [Windows.Markup.XamlReader]::Load($reader)

# ---------- Grab controls ----------
$BtnConnect=$win.FindName('BtnConnect'); $CbDeviceConfigs=$win.FindName('CbDeviceConfigs'); $CbSettingsCatalog=$win.FindName('CbSettingsCatalog')
$CbEndpointASR=$win.FindName('CbEndpointASR'); $TxtOut=$win.FindName('TxtOut'); $BtnBrowse=$win.FindName('BtnBrowse')
$LblStatus=$win.FindName('LblStatus'); $Log=$win.FindName('Log'); $Bar=$win.FindName('Bar')
$BtnStart=$win.FindName('BtnStart'); $BtnOpen=$win.FindName('BtnOpen'); $BtnClose=$win.FindName('BtnClose'); $CbDryRun=$win.FindName('CbDryRun')

function LogMsg([string]$m){ $ts=Get-Date -Format "HH:mm:ss"; $Log.AppendText("[$ts] $m`r`n"); $Log.ScrollToEnd() }
function SetStatus([string]$s){ $LblStatus.Text = "Status: $s" }

function Ensure-Folder([string]$p){
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

# ---------- Connect ----------
$BtnConnect.Add_Click({
  try {
    Connect-MgGraph -Environment $Environment -Scopes $ScopesWanted -NoWelcome | Out-Null
    Export-MgContext -Path $GraphContextPath -Force
    $ctx = Get-MgContext
    LogMsg ("Connected as {0}" -f $ctx.Account)
  } catch { LogMsg ("Connect failed: {0}" -f $_.Exception.Message) }
})

# ---------- Browse ----------
$BtnBrowse.Add_Click({
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $TxtOut.Text = $dlg.SelectedPath }
})

$BtnOpen.Add_Click({ if (Test-Path $TxtOut.Text) { Start-Process $TxtOut.Text } })

# ---------- Export helpers ----------
function Export-ListToCsv([object[]]$data, [string[]]$fields, [string]$path){
  if (-not $data) { return }
  $table = foreach($d in $data){
    $obj=[ordered]@{}
    foreach($f in $fields){ $obj[$f] = $d.$f }
    [pscustomobject]$obj
  }
  $table | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $path -Force
}

# ---------- Calls ----------
function Get-DeviceConfigurations {
  # classic profiles
  $uri = "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations?$select=id,displayName,description,createdDateTime,lastModifiedDateTime,version"
  (Invoke-MgGraphRequest -Method GET -Uri $uri).value
}
function Get-SettingsCatalogPolicies {
  $uri = "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies?$select=id,name,description,platforms,technologies,creationSource,settingCount,modifiedDateTime"
  (Invoke-MgGraphRequest -Method GET -Uri $uri).value
}
function Get-EndpointSecurityIntents {
  # Use intents; later we can refine by template/category; include all endpoint security intents and filter by Antivirus/ASR naming
  $uri = "https://graph.microsoft.com/beta/deviceManagement/intents?$select=id,displayName,description,category,templateId,lastModifiedDateTime"
  $all = (Invoke-MgGraphRequest -Method GET -Uri $uri).value
  $all | Where-Object { $_.category -like "*endpointSecurity*" -or $_.displayName -match "(?i)ASR|Attack Surface" }
}

# ---------- Start ----------
$BtnStart.Add_Click({
  try {
    if (-not (Get-MgContext)) { [System.Windows.MessageBox]::Show("Please Connect first.","Audit") | Out-Null; return }
    $out = $TxtOut.Text; Ensure-Folder $out
    $Bar.Value = 0; SetStatus "Starting"; LogMsg "Starting export..."

    $steps = @()
    if ($CbDeviceConfigs.IsChecked)    { $steps += "DeviceConfigs" }
    if ($CbSettingsCatalog.IsChecked)  { $steps += "SettingsCatalog" }
    if ($CbEndpointASR.IsChecked)      { $steps += "EndpointASR" }
    $total = [math]::Max(1, $steps.Count); $i=0

    foreach($s in $steps){
      $i++
      $Bar.Value = [int](100 * ($i-1)/$total)
      switch ($s) {
        "DeviceConfigs" {
          SetStatus "Device Configuration profiles"
          LogMsg "Querying deviceConfigurations..."
          $data = Get-DeviceConfigurations
          $path = Join-Path $out "deviceConfigurations.csv"
          Export-ListToCsv $data @('id','displayName','description','createdDateTime','lastModifiedDateTime','version') $path
          LogMsg ("Wrote: {0} (items: {1})" -f $path, ($data | Measure-Object).Count)
        }
        "SettingsCatalog" {
          SetStatus "Settings Catalog"
          LogMsg "Querying configurationPolicies..."
          $data = Get-SettingsCatalogPolicies
          $path = Join-Path $out "settingsCatalog_policies.csv"
          Export-ListToCsv $data @('id','name','description','platforms','technologies','creationSource','settingCount','modifiedDateTime') $path
          LogMsg ("Wrote: {0} (items: {1})" -f $path, ($data | Measure-Object).Count)
        }
        "EndpointASR" {
          SetStatus "Endpoint Security (ASR-ish)"
          LogMsg "Querying endpoint security intents (filtering for Antivirus/ASR)..."
          $data = Get-EndpointSecurityIntents
          $path = Join-Path $out "endpointSecurity_ASR.csv"
          Export-ListToCsv $data @('id','displayName','description','category','templateId','lastModifiedDateTime') $path
          LogMsg ("Wrote: {0} (items: {1})" -f $path, ($data | Measure-Object).Count)
        }
      }
    }

    $Bar.Value = 100; SetStatus "Complete"; LogMsg "Export complete."
  } catch {
    LogMsg ("Failed: {0}" -f $_.Exception.Message)
    SetStatus "Error"
  }
})

$BtnClose.Add_Click({ $win.Close() })

# ---------- Show ----------
$win.ShowDialog() | Out-Null
