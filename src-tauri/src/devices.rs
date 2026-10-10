//! USB, Wi-Fi and Bluetooth: things the browser can't enumerate.

use crate::shell::run;
use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter};
use nusb::MaybeFuture;
use serde::Serialize;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDevice {
    /// Stable for as long as the device stays plugged in.
    id: String,
    vendor_id: u16,
    product_id: u16,
    name: String,
    is_hub: bool,
}

#[tauri::command]
pub fn usb_devices() -> Result<Vec<UsbDevice>, String> {
    let devices = nusb::list_devices().wait().map_err(|e| e.to_string())?;
    Ok(devices
        .map(|d| {
            let name = match (d.manufacturer_string(), d.product_string()) {
                (Some(m), Some(p)) => format!("{m} {p}"),
                (None, Some(p)) => p.to_string(),
                (Some(m), None) => m.to_string(),
                (None, None) => format!("{:04x}:{:04x}", d.vendor_id(), d.product_id()),
            };
            UsbDevice {
                id: format!("{:?}", d.id()),
                vendor_id: d.vendor_id(),
                product_id: d.product_id(),
                name,
                is_hub: d.class() == 0x09,
            }
        })
        .collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiNetwork {
    ssid: String,
    signal_pct: Option<u8>,
}

#[tauri::command]
pub async fn wifi_scan() -> Result<Vec<WifiNetwork>, String> {
    let mut nets = if cfg!(windows) {
        parse_netsh(&run("netsh", &["wlan", "show", "networks", "mode=bssid"])?)
    } else {
        parse_nmcli(&run(
            "nmcli",
            &[
                "-t",
                "-f",
                "SSID,SIGNAL",
                "dev",
                "wifi",
                "list",
                "--rescan",
                "yes",
            ],
        )?)
    };
    nets.sort_by(|a, b| b.signal_pct.cmp(&a.signal_pct));
    Ok(dedupe(nets))
}

/// One entry per SSID (strongest access point first); hidden networks kept.
fn dedupe(sorted: Vec<WifiNetwork>) -> Vec<WifiNetwork> {
    let mut seen = std::collections::HashSet::new();
    sorted
        .into_iter()
        .filter(|n| n.ssid.is_empty() || seen.insert(n.ssid.clone()))
        .collect()
}

/// `netsh wlan show networks mode=bssid` (labels are localized, but "SSID n"
/// and "Signal" are the same in English and French).
fn parse_netsh(out: &str) -> Vec<WifiNetwork> {
    let mut nets: Vec<WifiNetwork> = vec![];
    for line in out.lines().map(str::trim) {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let (key, value) = (key.trim(), value.trim());
        if key.starts_with("SSID ") {
            nets.push(WifiNetwork {
                ssid: value.to_string(),
                signal_pct: None,
            });
        } else if key == "Signal" {
            let pct = value.trim_end_matches('%').trim().parse().ok();
            if let Some(net) = nets.last_mut() {
                net.signal_pct = net.signal_pct.max(pct); // best BSSID wins
            }
        }
    }
    nets
}

/// `nmcli -t -f SSID,SIGNAL` → `name:80`, with `:` inside names escaped as `\:`.
fn parse_nmcli(out: &str) -> Vec<WifiNetwork> {
    out.lines()
        .filter_map(|line| {
            let (ssid, signal) = line.rsplit_once(':')?;
            Some(WifiNetwork {
                ssid: ssid.replace("\\:", ":"),
                signal_pct: signal.trim().parse().ok(),
            })
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothScan {
    adapter: String,
    devices: Vec<BluetoothDevice>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothDevice {
    name: Option<String>,
    address: String,
    rssi: Option<i16>,
}

/// Bluetooth Low Energy scan. Classic-only devices (old headphones) may not show.
#[tauri::command]
pub async fn bluetooth_scan(seconds: u64) -> Result<BluetoothScan, String> {
    let err = |e: btleplug::Error| e.to_string();
    let manager = btleplug::platform::Manager::new().await.map_err(err)?;
    let central = manager
        .adapters()
        .await
        .map_err(err)?
        .into_iter()
        .next()
        .ok_or("No Bluetooth adapter found")?;
    let adapter = central
        .adapter_info()
        .await
        .unwrap_or_else(|_| "Bluetooth adapter".into());
    central
        .start_scan(ScanFilter::default())
        .await
        .map_err(err)?;
    tokio::time::sleep(Duration::from_secs(seconds.clamp(1, 30))).await;
    let peripherals = central.peripherals().await.map_err(err)?;
    let _ = central.stop_scan().await;

    let mut devices = vec![];
    for p in peripherals {
        if let Ok(Some(props)) = p.properties().await {
            devices.push(BluetoothDevice {
                name: props.local_name,
                address: props.address.to_string(),
                rssi: props.rssi,
            });
        }
    }
    devices.sort_by(|a, b| b.rssi.cmp(&a.rssi));
    Ok(BluetoothScan { adapter, devices })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_netsh_networks() {
        let out = "\nSSID 1 : Livebox-1234\n    Type de réseau          : Infrastructure\n    BSSID 1                 : aa:bb:cc:dd:ee:ff\n         Signal             : 62%\n    BSSID 2                 : aa:bb:cc:dd:ee:00\n         Signal             : 88%\nSSID 2 : \n    BSSID 1                 : 11:22:33:44:55:66\n         Signal             : 40%\n";
        let nets = parse_netsh(out);
        assert_eq!(nets.len(), 2);
        assert_eq!(nets[0].ssid, "Livebox-1234");
        assert_eq!(nets[0].signal_pct, Some(88));
        assert_eq!(nets[1].ssid, "");
        assert_eq!(nets[1].signal_pct, Some(40));
    }

    #[test]
    fn parses_nmcli_with_escaped_colons() {
        let nets = parse_nmcli("Home\\:5G:74\nCafe:31\n");
        assert_eq!(nets[0].ssid, "Home:5G");
        assert_eq!(nets[0].signal_pct, Some(74));
        assert_eq!(nets[1].signal_pct, Some(31));
    }

    #[test]
    fn dedupes_ssids_keeping_the_first() {
        let nets = dedupe(parse_nmcli("Home:90\nCafe:60\nHome:40\n:30\n:20\n"));
        let names: Vec<_> = nets
            .iter()
            .map(|n| (n.ssid.as_str(), n.signal_pct))
            .collect();
        assert_eq!(
            names,
            [
                ("Home", Some(90)),
                ("Cafe", Some(60)),
                ("", Some(30)),
                ("", Some(20))
            ]
        );
    }
}
