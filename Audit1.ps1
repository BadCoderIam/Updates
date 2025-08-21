# Audit.ps1
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase -ErrorAction SilentlyContinue

# ---------------- Defaults & Graph ----------------
if (-not (Get-Variable -Name Environment -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace($Environment)) { $Environment = 'USGov' }
$AppDataRoot = Join-Path $env:APPDATA 'IntuneTools'
if (-not (Test-Path $AppDataRoot)) { New-Item -ItemType Directory -Path $AppDataRoot -Force | Out-Null }
$GraphContextPath = Join-Path $AppDataRoot 'mgcontext.json'

$Scopes = @(
  'User.Read',
  'Group.Read.All',
  'DeviceManagementConfiguration.Read.All'
)

Import-Module Microsoft.Graph.Authentication -ErrorAction SilentlyContinue
try { if (Test-Path $GraphContextPath) { Import-MgContext -Path $GraphContextPath -ErrorAction SilentlyContinue | Out-Null } } catch {}

# ---------------- UI (compact, dark) ---------------
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Intune Audit" Width="980" Height="660"
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

      <GroupBox Grid.Row="0" Header="Sections to Export">
        <UniformGrid Columns="2">
          <CheckBox x:Name="CbDeviceConfigs"   IsChecked="True" Content="Device Configuration"/>
          <CheckBox x:Name="CbSettingsCatalog" IsChecked="True" Content="Settings Catalog"/>
          <CheckBox x:Name="CbEndpointASR"     IsChecked="True" Content="Endpoint Security"/>
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
        <StackPanel>
          <TextBlock x:Name="LblStatus" Text="Status: Idle" Margin="2"/>
          <ProgressBar x:Name="Bar" Height="12" Minimum="0" Maximum="100" Margin="2"/>
          <TextBox x:Name="Log" IsReadOnly="True" MinHeight="360" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto"/>
        </StackPanel>
      </GroupBox>

      <DockPanel Grid.Row="3">
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
          <Button x:Name="BtnStart" Content="Start" Width="110"/>
          <Button x:Name="BtnOpen"  Content="Open folder" Width="110"/>
          <Button x:Name="BtnClose" Content="Close" Width="110"/>
        </StackPanel>
      </DockPanel>
    </Grid>
  </DockPanel>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader($xaml)
$win = [Windows.Markup.XamlReader]::Load($reader)

# ---------------- Controls ----------------
$BtnConnect=$win.FindName('BtnConnect'); $CbDeviceConfigs=$win.FindName('CbDeviceConfigs')
$CbSettingsCatalog=$win.FindName('CbSettingsCatalog'); $CbEndpointASR=$win.FindName('CbEndpointASR')
$TxtOut=$win.FindName('TxtOut'); $BtnBrowse=$win.FindName('BtnBrowse')
$LblStatus=$win.FindName('LblStatus'); $Log=$win.FindName('Log'); $Bar=$win.FindName('Bar')
$BtnStart=$win.FindName('BtnStart'); $BtnOpen=$win.FindName('BtnOpen'); $BtnClose=$win.FindName('BtnClose')

function LogMsg([string]$m){ $ts=Get-Date -Format "HH:mm:ss"; $Log.AppendText("[$ts] $m`r`n"); $Log.ScrollToEnd() }
function SetStatus([string]$s){ $LblStatus.Text = "Status: $s" }
function Ensure-Folder([string]$p){ if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }

# ---------------- Connect (SSO) ----------------
$BtnConnect.Add_Click({
  try {
    Connect-MgGraph -Environment $Environment -Scopes $Scopes -NoWelcome | Out-Null
    Export-MgContext -Path $GraphContextPath -Force
    $ctx = Get-MgContext
    LogMsg ("Connected as {0}" -f $ctx.Account)
  } catch { LogMsg ("Connect failed: {0}" -f $_.Exception.Message) }
})

# ---------------- Browse/Open ----------------
$BtnBrowse.Add_Click({
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $TxtOut.Text = $dlg.SelectedPath }
})
$BtnOpen.Add_Click({ if (Test-Path $TxtOut.Text) { Start-Process $TxtOut.Text } })

# ---------------- Export helpers --------------
function Export-ListToCsv([object[]]$data, [string[]]$fields, [string]$path){
  if (-not $data) { return }
  $table = foreach($d in $data){
    $obj=[ordered]@{}; foreach($f in $fields){ $obj[$f] = $d.$f }; [pscustomobject]$obj
  }
  $table | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $path -Force
}

# ---------------- Graph calls -----------------
# Using beta for breadth (settings & endpoint security). This is read-only.
function Get-DeviceConfigurations {
  $uri = "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations?$select=id,displayName,description,createdDateTime,lastModifiedDateTime,version,@odata.type"
  (Invoke-MgGraphRequest -Method GET -Uri $uri).value
}
function Get-SettingsCatalogPolicies {
  $uri = "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies?$select=id,name,description,platforms,technologies,settingCount,modifiedDateTime"
  (Invoke-MgGraphRequest -Method GET -Uri $uri).value
}
function Get-SettingsCatalogPolicySettings([string]$policyId){
  $uri = "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies/$policyId/settings"
  (Invoke-MgGraphRequest -Method GET -Uri $uri).value
}
function Get-EndpointSecurityIntents {
  $uri = "https://graph.microsoft.com/beta/deviceManagement/intents?$select=id,displayName,description,category,templateId,lastModifiedDateTime"
  $all = (Invoke-MgGraphRequest -Method GET -Uri $uri).value
  $all | Where-Object { $_.category -like "*endpointSecurity*" -or $_.displayName -match "(?i)ASR|Attack Surface" }
}
function Get-IntentSettings([string]$intentId){
  $uri = "https://graph.microsoft.com/beta/deviceManagement/intents/$intentId/settings"
  (Invoke-MgGraphRequest -Method GET -Uri $uri).value
}

# ---------------- Start Export ----------------
$BtnStart.Add_Click({
  try {
    if (-not (Get-MgContext)) { [System.Windows.MessageBox]::Show("Please Connect first.","Audit") | Out-Null; return }
    $out = $TxtOut.Text; Ensure-Folder $out
    $Bar.Value = 0; SetStatus "Starting"; LogMsg "Starting export..."

    $steps = @()
    if ($CbDeviceConfigs.IsChecked)   { $steps += "DeviceConfigs" }
    if ($CbSettingsCatalog.IsChecked) { $steps += "SettingsCatalog" }
    if ($CbEndpointASR.IsChecked)     { $steps += "EndpointASR" }
    $total = [math]::Max(1, $steps.Count); $i=0

    foreach($s in $steps){
      $i++; $Bar.Value = [int](100 * ($i-1)/$total)
      switch ($s) {

        "DeviceConfigs" {
          SetStatus "Device Configuration (classic)"
          LogMsg "Querying deviceConfigurations..."
          $data = Get-DeviceConfigurations
          $path = Join-Path $out "deviceConfigurations.csv"
          Export-ListToCsv $data @('id','displayName','description','createdDateTime','lastModifiedDateTime','version','@odata.type') $path
          LogMsg ("Wrote: {0} (items: {1})" -f $path, ($data | Measure-Object).Count)
        }

        "SettingsCatalog" {
          SetStatus "Settings Catalog (policies)"
          LogMsg "Querying configurationPolicies..."
          $pol = Get-SettingsCatalogPolicies
          $path1 = Join-Path $out "settingsCatalog_policies.csv"
          Export-ListToCsv $pol @('id','name','description','platforms','technologies','settingCount','modifiedDateTime') $path1
          LogMsg ("Wrote: {0} (items: {1})" -f $path1, ($pol | Measure-Object).Count)

          # Settings (flatten) — optional; include a few key fields
          LogMsg "Querying settings for each policy (this may take time)..."
          $rows = foreach($p in $pol){
            $settings = Get-SettingsCatalogPolicySettings $p.id
            foreach($s in $settings){
              $def = $s.settingDefinitions[0]
              $name = $def.displayName
              $defId = $def.definitionId
              $val = $s.settingInstance.valueJson
              [pscustomobject]@{ policyId=$p.id; policyName=$p.name; setting=$name; definition=$defId; valueJson=$val }
            }
          }
          $path2 = Join-Path $out "settingsCatalog_settings.csv"
          $rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $path2 -Force
          LogMsg ("Wrote: {0} (rows: {1})" -f $path2, ($rows | Measure-Object).Count)
        }

        "EndpointASR" {
          SetStatus "Endpoint Security (ASR/intents)"
          LogMsg "Querying endpoint security intents (ASR)..."
          $intents = Get-EndpointSecurityIntents
          $path1 = Join-Path $out "endpointSecurity_ASR.csv"
          Export-ListToCsv $intents @('id','displayName','description','category','templateId','lastModifiedDateTime') $path1
          LogMsg ("Wrote: {0} (items: {1})" -f $path1, ($intents | Measure-Object).Count)

          LogMsg "Querying settings for each ASR intent..."
          $rows = foreach($i2 in $intents){
            $settings = Get-IntentSettings $i2.id
            foreach($s in $settings){
              $name = $s.definition.displayName
              $defId = $s.definition.id
              $val = $s.valueJson
              [pscustomobject]@{ intentId=$i2.id; intentName=$i2.displayName; setting=$name; definition=$defId; valueJson=$val }
            }
          }
          $path2 = Join-Path $out "endpointSecurity_ASR_settings.csv"
          $rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $path2 -Force
          LogMsg ("Wrote: {0} (rows: {1})" -f $path2, ($rows | Measure-Object).Count)
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

$win.ShowDialog() | Out-Null
