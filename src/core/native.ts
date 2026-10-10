// Typed bindings to the Rust commands in src-tauri/src. Only callable in the
// desktop app — check `isDesktop` first.
import { invoke } from '@tauri-apps/api/core'

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface Disk {
  name: string
  mount: string
  fileSystem: string
  totalBytes: number
  availableBytes: number
  kind: string
  removable: boolean
}

export interface SystemInfo {
  os: string | null
  hostname: string | null
  cpuBrand: string | null
  cpuCores: number | null
  cpuThreads: number
  ramBytes: number
  gpus: string[]
  disks: Disk[]
}

export interface BatteryInfo {
  vendor: string | null
  model: string | null
  technology: string
  state: string
  chargePct: number
  energyWh: number
  energyFullWh: number
  energyDesignWh: number
  healthPct: number
  cycleCount: number | null
}

export interface DiskHealth {
  name: string
  mediaType: string | null
  bus: string | null
  sizeBytes: number | null
  health: string | null
  wearPct: number | null
  temperatureC: number | null
  powerOnHours: number | null
  mediaErrors: number | null
}

export interface FirmwareInfo {
  manufacturer: string | null
  model: string | null
  serial: string | null
  biosVendor: string | null
  biosVersion: string | null
  biosDate: string | null
  adminPassword: string | null
  powerOnPassword: string | null
}

export interface WindowsStatus {
  activated: boolean | null
  licenseName: string | null
  azureAdJoined: boolean | null
  domainJoined: boolean | null
  enterpriseJoined: boolean | null
  autopilotTenant: string | null
  mdmProviders: string[]
}

export interface UsbDevice {
  id: string
  vendorId: number
  productId: number
  name: string
  isHub: boolean
}

export interface WifiNetwork {
  ssid: string
  signalPct: number | null
}

export interface BluetoothScan {
  adapter: string
  devices: { name: string | null; address: string; rssi: number | null }[]
}

export const native = {
  systemInfo: () => invoke<SystemInfo>('system_info'),
  batteryInfo: () => invoke<BatteryInfo[]>('battery_info'),
  storageHealth: () => invoke<DiskHealth[]>('storage_health'),
  firmwareInfo: () => invoke<FirmwareInfo>('firmware_info'),
  windowsStatus: () => invoke<WindowsStatus>('windows_status'),
  usbDevices: () => invoke<UsbDevice[]>('usb_devices'),
  wifiScan: () => invoke<WifiNetwork[]>('wifi_scan'),
  bluetoothScan: (seconds: number) => invoke<BluetoothScan>('bluetooth_scan', { seconds }),
}

export const formatBytes = (n: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${n.toFixed(i >= 3 ? 1 : 0)} ${units[i]}`
}
