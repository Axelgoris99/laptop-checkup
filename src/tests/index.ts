import type { TestDef } from '../core/types'
import { Microphone, Speakers, Webcam } from './av'
import { ExternalDisplay, Screen } from './display'
import { Battery, Firmware, Specs, Storage, WindowsLock } from './info'
import { Keyboard, Touchpad } from './input'
import { Bluetooth, ChargingPorts, UsbPorts, Wifi } from './ports'
import { Stress } from './thermal'

export const TESTS: TestDef[] = [
  { id: 'specs', group: 'System', title: 'Specs', needs: 'any', hint: 'Processor, RAM, storage and screen match the ad', Component: Specs },
  { id: 'battery', group: 'System', title: 'Battery', needs: 'any', hint: '70% or more of the original capacity', Component: Battery },
  {
    id: 'storage', group: 'System', title: 'SSD health', needs: 'desktop', hint: 'Drive reports healthy, little wear',
    manual: ['Run CrystalDiskInfo (portable) from a USB stick', 'Health should say “Good”, ideally above 90%'],
    Component: Storage,
  },
  {
    id: 'firmware', group: 'System', title: 'BIOS & serial', needs: 'desktop', hint: 'No BIOS password, serial matches',
    manual: ['Restart and press F2 (or Del / F10): the BIOS must open without a password', 'Compare the serial in the BIOS with the sticker underneath'],
    Component: Firmware,
  },
  {
    id: 'windows', group: 'System', title: 'Activation & company lock', needs: 'desktop', hint: 'Activated, not managed by a company',
    manual: [
      'Settings → System → Activation: “Windows is activated”',
      'Terminal → dsregcmd /status: AzureAdJoined and DomainJoined should be NO',
      'Settings → Accounts → Access work or school: should be empty',
    ],
    Component: WindowsLock,
  },
  { id: 'screen', group: 'Display', title: 'Screen', needs: 'any', hint: 'No dead pixels, burn-in or blotches', Component: Screen },
  { id: 'external', group: 'Display', title: 'External display', needs: 'any', hint: 'HDMI / USB-C video output works', Component: ExternalDisplay },
  { id: 'keyboard', group: 'Input', title: 'Keyboard', needs: 'any', hint: 'Every key registers, backlight works', Component: Keyboard },
  { id: 'touchpad', group: 'Input', title: 'Touchpad', needs: 'any', hint: 'Smooth tracking, clicks and gestures', Component: Touchpad },
  { id: 'speakers', group: 'Audio & video', title: 'Speakers & jack', needs: 'any', hint: 'Left/right correct, no rattle', Component: Speakers },
  { id: 'mic', group: 'Audio & video', title: 'Microphone', needs: 'any', hint: 'Picks up voice clearly', Component: Microphone },
  { id: 'webcam', group: 'Audio & video', title: 'Webcam', needs: 'any', hint: 'Sharp image, light turns on', Component: Webcam },
  { id: 'charging', group: 'Ports & wireless', title: 'Charging ports', needs: 'any', hint: 'Charges from every USB-C port', Component: ChargingPorts },
  {
    id: 'usb', group: 'Ports & wireless', title: 'USB ports', needs: 'desktop', hint: 'Every port detects a device',
    manual: ['Plug a USB stick into each port', 'It should appear in File Explorer each time'],
    Component: UsbPorts,
  },
  { id: 'wifi', group: 'Ports & wireless', title: 'Wi-Fi', needs: 'any', hint: 'Connects and reaches the internet', Component: Wifi },
  { id: 'bluetooth', group: 'Ports & wireless', title: 'Bluetooth', needs: 'any', hint: 'Finds and pairs devices', Component: Bluetooth },
  { id: 'stress', group: 'Heat', title: 'Fan & heat', needs: 'any', hint: 'Stays stable under load, fan sounds normal', Component: Stress },
]
