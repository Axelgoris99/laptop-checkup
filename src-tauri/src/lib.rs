mod devices;
mod shell;
mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system::system_info,
            system::battery_info,
            system::storage_health,
            system::firmware_info,
            system::windows_status,
            devices::usb_devices,
            devices::wifi_scan,
            devices::bluetooth_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod probe {
    #[test]
    #[ignore]
    fn print_native() {
        let j = |v: &dyn erased::Ser| println!("{}", v.json());
        j(&crate::system::system_info());
        j(&crate::system::battery_info());
        j(&crate::system::storage_health());
        j(&crate::system::firmware_info());
        j(&crate::system::windows_status());
        j(&crate::devices::usb_devices());
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        j(&rt.block_on(crate::devices::wifi_scan()));
        j(&rt.block_on(crate::devices::bluetooth_scan(3)));
    }
    mod erased {
        pub trait Ser {
            fn json(&self) -> String;
        }
        impl<T: serde::Serialize> Ser for T {
            fn json(&self) -> String {
                serde_json::to_string(self).unwrap()
            }
        }
    }
}
