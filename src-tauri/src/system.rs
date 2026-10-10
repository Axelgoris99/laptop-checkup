//! Specs, battery wear, disk health and firmware identity.

use crate::shell::{as_array, num_field, powershell_json, run, str_field, windows_only};
use serde::Serialize;
use serde_json::Value;
use starship_battery::units::{energy::watt_hour, ratio::percent};
use sysinfo::{DiskKind, Disks, System};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Disk {
    name: String,
    mount: String,
    file_system: String,
    total_bytes: u64,
    available_bytes: u64,
    kind: String,
    removable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    os: Option<String>,
    hostname: Option<String>,
    cpu_brand: Option<String>,
    cpu_cores: Option<usize>,
    cpu_threads: usize,
    ram_bytes: u64,
    gpus: Vec<String>,
    disks: Vec<Disk>,
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    let mut sys = System::new();
    sys.refresh_memory();
    sys.refresh_cpu_all();
    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|d| Disk {
            name: d.name().to_string_lossy().into_owned(),
            mount: d.mount_point().to_string_lossy().into_owned(),
            file_system: d.file_system().to_string_lossy().into_owned(),
            total_bytes: d.total_space(),
            available_bytes: d.available_space(),
            kind: match d.kind() {
                DiskKind::SSD => "SSD".into(),
                DiskKind::HDD => "HDD".into(),
                _ => "Unknown".into(),
            },
            removable: d.is_removable(),
        })
        .collect();
    SystemInfo {
        os: System::long_os_version(),
        hostname: System::host_name(),
        cpu_brand: sys.cpus().first().map(|c| c.brand().trim().to_string()),
        cpu_cores: System::physical_core_count(),
        cpu_threads: sys.cpus().len(),
        ram_bytes: sys.total_memory(),
        gpus: gpu_names(),
        disks,
    }
}

fn gpu_names() -> Vec<String> {
    if cfg!(windows) {
        powershell_json(
            "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name",
        )
        .map(as_array)
        .unwrap_or_default()
        .iter()
        .filter_map(|v| v.as_str().map(str::to_string))
        .collect()
    } else {
        run("lspci", &[])
            .unwrap_or_default()
            .lines()
            .filter(|l| l.contains("VGA") || l.contains("3D controller") || l.contains("Display"))
            .filter_map(|l| l.split_once(": ").map(|(_, name)| name.to_string()))
            .collect()
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    vendor: Option<String>,
    model: Option<String>,
    technology: String,
    state: String,
    charge_pct: f32,
    energy_wh: f32,
    energy_full_wh: f32,
    energy_design_wh: f32,
    health_pct: f32,
    cycle_count: Option<u32>,
}

#[tauri::command]
pub fn battery_info() -> Result<Vec<BatteryInfo>, String> {
    let manager = starship_battery::Manager::new().map_err(|e| e.to_string())?;
    let batteries = manager.batteries().map_err(|e| e.to_string())?;
    let mut out = vec![];
    for b in batteries {
        let b = b.map_err(|e| e.to_string())?;
        out.push(BatteryInfo {
            vendor: b.vendor().map(str::to_string),
            model: b.model().map(str::to_string),
            technology: b.technology().to_string(),
            state: b.state().to_string(),
            charge_pct: b.state_of_charge().get::<percent>(),
            energy_wh: b.energy().get::<watt_hour>(),
            energy_full_wh: b.energy_full().get::<watt_hour>(),
            energy_design_wh: b.energy_full_design().get::<watt_hour>(),
            health_pct: b.state_of_health().get::<percent>(),
            cycle_count: b.cycle_count(),
        });
    }
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskHealth {
    name: String,
    media_type: Option<String>,
    bus: Option<String>,
    size_bytes: Option<f64>,
    /// "Healthy" / "Warning" / "Unhealthy", or SMART passed/failed on Linux.
    health: Option<String>,
    /// Percentage of rated endurance used (0 = new).
    wear_pct: Option<f64>,
    temperature_c: Option<f64>,
    power_on_hours: Option<f64>,
    media_errors: Option<f64>,
}

#[tauri::command]
pub fn storage_health() -> Result<Vec<DiskHealth>, String> {
    if cfg!(windows) {
        storage_health_windows()
    } else {
        storage_health_smartctl()
    }
}

fn storage_health_windows() -> Result<Vec<DiskHealth>, String> {
    // Reliability counters need admin; without it they come back empty.
    let disks = powershell_json(
        "Get-PhysicalDisk | ForEach-Object { \
           $r = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue; \
           [pscustomobject]@{ name=$_.FriendlyName; mediaType=\"$($_.MediaType)\"; bus=\"$($_.BusType)\"; \
             size=$_.Size; health=\"$($_.HealthStatus)\"; wear=$r.Wear; temperature=$r.Temperature; \
             hours=$r.PowerOnHours; errors=$r.ReadErrorsUncorrected } }",
    )?;
    Ok(as_array(disks)
        .iter()
        .map(|d| DiskHealth {
            name: str_field(d, "name").unwrap_or_else(|| "Disk".into()),
            media_type: str_field(d, "mediaType"),
            bus: str_field(d, "bus"),
            size_bytes: num_field(d, "size"),
            health: str_field(d, "health"),
            wear_pct: num_field(d, "wear"),
            temperature_c: num_field(d, "temperature"),
            power_on_hours: num_field(d, "hours"),
            media_errors: num_field(d, "errors"),
        })
        .collect())
}

fn storage_health_smartctl() -> Result<Vec<DiskHealth>, String> {
    let scan: Value = serde_json::from_str(&run("smartctl", &["--scan", "-j"])?)
        .map_err(|e| format!("smartctl: {e}"))?;
    let mut out = vec![];
    for dev in scan["devices"].as_array().into_iter().flatten() {
        let Some(path) = dev["name"].as_str() else {
            continue;
        };
        let Ok(raw) = run("smartctl", &["-a", "-j", path]) else {
            continue;
        };
        let Ok(j) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        let nvme = &j["nvme_smart_health_information_log"];
        out.push(DiskHealth {
            name: j["model_name"].as_str().unwrap_or(path).to_string(),
            media_type: Some(
                if j["rotation_rate"].as_u64().unwrap_or(0) > 0 {
                    "HDD"
                } else {
                    "SSD"
                }
                .into(),
            ),
            bus: dev["type"].as_str().map(str::to_string),
            size_bytes: j["user_capacity"]["bytes"].as_f64(),
            health: j["smart_status"]["passed"].as_bool().map(|ok| {
                if ok {
                    "Healthy".into()
                } else {
                    "Failing".into()
                }
            }),
            wear_pct: nvme["percentage_used"].as_f64(),
            temperature_c: j["temperature"]["current"].as_f64(),
            power_on_hours: j["power_on_time"]["hours"].as_f64(),
            media_errors: nvme["media_errors"].as_f64(),
        });
    }
    if out.is_empty() {
        return Err("smartctl found no readable disk (try running as root)".into());
    }
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareInfo {
    manufacturer: Option<String>,
    model: Option<String>,
    serial: Option<String>,
    bios_vendor: Option<String>,
    bios_version: Option<String>,
    bios_date: Option<String>,
    /// Firmware-reported status; many vendors answer "Unknown".
    admin_password: Option<String>,
    power_on_password: Option<String>,
}

#[tauri::command]
pub fn firmware_info() -> Result<FirmwareInfo, String> {
    if cfg!(windows) {
        let j = powershell_json(
            "$b = Get-CimInstance Win32_BIOS; $c = Get-CimInstance Win32_ComputerSystem; \
             [pscustomobject]@{ manufacturer=$c.Manufacturer; model=$c.Model; serial=$b.SerialNumber; \
               biosVendor=$b.Manufacturer; biosVersion=$b.SMBIOSBIOSVersion; \
               biosDate=$(if ($b.ReleaseDate) { $b.ReleaseDate.ToString('yyyy-MM-dd') }); \
               admin=$c.AdminPasswordStatus; powerOn=$c.PowerOnPasswordStatus }",
        )?;
        let status = |key| num_field(&j, key).map(|n| password_status(n as u8).to_string());
        Ok(FirmwareInfo {
            manufacturer: str_field(&j, "manufacturer"),
            model: str_field(&j, "model"),
            serial: str_field(&j, "serial"),
            bios_vendor: str_field(&j, "biosVendor"),
            bios_version: str_field(&j, "biosVersion"),
            bios_date: str_field(&j, "biosDate"),
            admin_password: status("admin"),
            power_on_password: status("powerOn"),
        })
    } else {
        let dmi = |f: &str| {
            std::fs::read_to_string(format!("/sys/class/dmi/id/{f}"))
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        };
        Ok(FirmwareInfo {
            manufacturer: dmi("sys_vendor"),
            model: dmi("product_name"),
            serial: dmi("product_serial"), // root-only on most distros
            bios_vendor: dmi("bios_vendor"),
            bios_version: dmi("bios_version"),
            bios_date: dmi("bios_date"),
            admin_password: None,
            power_on_password: None,
        })
    }
}

// Win32_ComputerSystem *PasswordStatus values.
fn password_status(n: u8) -> &'static str {
    match n {
        0 => "Disabled",
        1 => "Enabled",
        2 => "Not implemented",
        _ => "Unknown",
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsStatus {
    activated: Option<bool>,
    license_name: Option<String>,
    azure_ad_joined: Option<bool>,
    domain_joined: Option<bool>,
    enterprise_joined: Option<bool>,
    /// Set when the device has an Autopilot profile (company-owned).
    autopilot_tenant: Option<String>,
    /// MDM enrollments (e.g. Intune), from the Enrollments registry key.
    mdm_providers: Vec<String>,
}

#[tauri::command]
pub fn windows_status() -> Result<WindowsStatus, String> {
    if !cfg!(windows) {
        return windows_only();
    }
    let j = powershell_json(
        "$lic = Get-CimInstance SoftwareLicensingProduct -Filter \
           \"ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL\" | \
           Select-Object -First 1; \
         $ap = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Provisioning\\Diagnostics\\Autopilot' -ErrorAction SilentlyContinue; \
         $mdm = @(Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Enrollments' -ErrorAction SilentlyContinue | \
           ForEach-Object { (Get-ItemProperty $_.PSPath).ProviderID } | Where-Object { $_ }); \
         [pscustomobject]@{ licenseName=$lic.Name; licenseStatus=$lic.LicenseStatus; \
           autopilotTenant=$ap.CloudAssignedTenantDomain; mdm=$mdm }",
    )?;
    let dsreg = run("dsregcmd", &["/status"]).unwrap_or_default();
    let joined = |key: &str| dsreg_flag(&dsreg, key);
    Ok(WindowsStatus {
        activated: num_field(&j, "licenseStatus").map(|n| n == 1.0),
        license_name: str_field(&j, "licenseName"),
        azure_ad_joined: joined("AzureAdJoined"),
        domain_joined: joined("DomainJoined"),
        enterprise_joined: joined("EnterpriseJoined"),
        autopilot_tenant: str_field(&j, "autopilotTenant"),
        mdm_providers: as_array(j.get("mdm").cloned().unwrap_or(Value::Null))
            .iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
    })
}

/// Reads a `Key : YES|NO` line from `dsregcmd /status`.
fn dsreg_flag(out: &str, key: &str) -> Option<bool> {
    out.lines().find_map(|line| {
        let (k, v) = line.split_once(':')?;
        (k.trim() == key).then(|| v.trim().eq_ignore_ascii_case("YES"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_dsregcmd_flags() {
        let out = "+----+\n| Device State |\n         AzureAdJoined : YES\n      EnterpriseJoined : NO\n          DomainJoined : NO\n";
        assert_eq!(dsreg_flag(out, "AzureAdJoined"), Some(true));
        assert_eq!(dsreg_flag(out, "DomainJoined"), Some(false));
        assert_eq!(dsreg_flag(out, "WorkplaceJoined"), None);
    }
}
