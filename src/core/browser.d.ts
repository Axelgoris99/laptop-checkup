// Chromium-only APIs missing from lib.dom.d.ts.

interface BatteryManager extends EventTarget {
  readonly charging: boolean
  readonly level: number
  readonly chargingTime: number
  readonly dischargingTime: number
}

interface ScreenDetailed {
  readonly width: number
  readonly height: number
  readonly label: string
  readonly isPrimary: boolean
  readonly isInternal: boolean
  readonly devicePixelRatio: number
}

interface BluetoothDevice {
  readonly name?: string
}

interface Navigator {
  getBattery?: () => Promise<BatteryManager>
  deviceMemory?: number
  bluetooth?: {
    getAvailability: () => Promise<boolean>
    requestDevice: (options: { acceptAllDevices: boolean }) => Promise<BluetoothDevice>
  }
}

interface Screen {
  readonly isExtended?: boolean
}

interface Window {
  getScreenDetails?: () => Promise<{ screens: ScreenDetailed[] }>
}
