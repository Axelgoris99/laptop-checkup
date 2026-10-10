import { useEffect, useRef, useState } from 'react'
import { Checks, Facts, Notice, Verdict } from '../components/ui'
import { isDesktop, native, type UsbDevice, type WifiNetwork, type BluetoothScan } from '../core/native'
import type { TestProps } from '../core/types'

type PortState = { name: string; status: 'idle' | 'armed' | 'ok'; detail?: string }

/** Editable list of ports, each tested one at a time. */
function PortList({
  ports,
  setPorts,
  armLabel,
}: {
  ports: PortState[]
  setPorts: (fn: (p: PortState[]) => PortState[]) => void
  armLabel: string
}) {
  const arm = (i: number) =>
    setPorts((ps) => ps.map((p, j) => (j === i ? { ...p, status: 'armed' } : p.status === 'armed' ? { ...p, status: 'idle' } : p)))
  return (
    <ul className="ports">
      {ports.map((p, i) => (
        <li key={i} className={p.status}>
          <input
            value={p.name}
            onChange={(e) => setPorts((ps) => ps.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))}
          />
          {p.status === 'ok' ? (
            <span className="good">✓ {p.detail}</span>
          ) : p.status === 'armed' ? (
            <span className="warn">{armLabel}</span>
          ) : (
            <button onClick={() => arm(i)}>Test</button>
          )}
          <button className="icon" title="Remove" onClick={() => setPorts((ps) => ps.filter((_, j) => j !== i))}>×</button>
        </li>
      ))}
      <li>
        <button onClick={() => setPorts((ps) => [...ps, { name: `Port ${ps.length + 1}`, status: 'idle' }])}>+ Add port</button>
      </li>
    </ul>
  )
}

export function ChargingPorts({ result, setResult }: TestProps) {
  const [charging, setCharging] = useState<boolean>()
  const [ports, setPorts] = useState<PortState[]>([
    { name: 'USB-C left', status: 'idle' },
    { name: 'USB-C right', status: 'idle' },
  ])
  // A port passes when the charger goes unplugged → plugged while it is armed.
  const sawUnplugged = useRef(false)

  useEffect(() => {
    if (!navigator.getBattery) return
    let bm: BatteryManager | undefined
    const update = () => bm && setCharging(bm.charging)
    navigator.getBattery().then((b) => {
      bm = b
      update()
      b.addEventListener('chargingchange', update)
    })
    return () => bm?.removeEventListener('chargingchange', update)
  }, [])

  useEffect(() => {
    if (charging === false) sawUnplugged.current = true
    if (charging && sawUnplugged.current) {
      setPorts((ps) => ps.map((p) => (p.status === 'armed' ? { ...p, status: 'ok', detail: 'charges' } : p)))
      sawUnplugged.current = false
    }
  }, [charging])

  const armed = ports.some((p) => p.status === 'armed')
  const allOk = ports.length > 0 && ports.every((p) => p.status === 'ok')

  return (
    <>
      <p>
        For each port: press <b>Test</b>, unplug the charger, then plug it into that port. Windows may take a
        few seconds to notice.
      </p>
      {charging == null ? (
        <Notice kind="warn">This browser can't see the charger (use Chrome or Edge). Check the charging light instead.</Notice>
      ) : (
        <Facts rows={[['Charger', charging ? 'Plugged in' : 'Unplugged', charging ? 'good' : undefined]]} />
      )}
      {armed && charging && <Notice>Unplug the charger first.</Notice>}
      <PortList ports={ports} setPorts={setPorts} armLabel="Plug the charger in here…" />
      <Checks items={['Charger is the original (65 W USB-C)', 'Charging light turns on']} />
      <Verdict
        result={result}
        setResult={setResult}
        suggestion={allOk ? { status: 'pass', reason: 'every port charges' } : undefined}
      />
    </>
  )
}

export function UsbPorts({ result, setResult }: TestProps) {
  const [devices, setDevices] = useState<UsbDevice[]>([])
  const [error, setError] = useState<string>()
  const [ports, setPorts] = useState<PortState[]>([
    { name: 'USB-C left', status: 'idle' },
    { name: 'USB-C right', status: 'idle' },
    { name: 'USB-A', status: 'idle' },
  ])
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    let live = true
    const poll = async () => {
      try {
        const list = await native.usbDevices()
        if (!live) return
        setError(undefined)
        setDevices(list)
        const ids = new Set(list.map((d) => d.id))
        const added = known.current ? list.filter((d) => !known.current!.has(d.id) && !d.isHub) : []
        known.current = ids
        if (added.length)
          setPorts((ps) => ps.map((p) => (p.status === 'armed' ? { ...p, status: 'ok', detail: added[0].name } : p)))
      } catch (e) {
        if (live) setError(String(e))
      }
    }
    void poll()
    const t = setInterval(poll, 1000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  const allOk = ports.length > 0 && ports.every((p) => p.status === 'ok')
  return (
    <>
      <p>For each port: press <b>Test</b>, then plug a USB stick, mouse or phone into it. It's detected within a second.</p>
      {error && <Notice kind="error">{error}</Notice>}
      <PortList ports={ports} setPorts={setPorts} armLabel="Plug a device in here…" />
      <details>
        <summary>{devices.length} USB devices connected</summary>
        <ul className="muted small">
          {devices.map((d) => (
            <li key={d.id}>{d.name}{d.isHub ? ' (hub)' : ''}</li>
          ))}
        </ul>
      </details>
      <Verdict result={result} setResult={setResult} suggestion={allOk ? { status: 'pass', reason: 'every port detects devices' } : undefined} />
    </>
  )
}

export function Wifi({ result, setResult }: TestProps) {
  const [online, setOnline] = useState(navigator.onLine)
  const [latency, setLatency] = useState<number[]>()
  const [nets, setNets] = useState<WifiNetwork[]>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const ping = async () => {
    setBusy(true)
    setError(undefined)
    const times: number[] = []
    try {
      for (let i = 0; i < 5; i++) {
        const t = performance.now()
        await fetch(`https://www.gstatic.com/generate_204?${Date.now()}`, { mode: 'no-cors', cache: 'no-store' })
        times.push(Math.round(performance.now() - t))
      }
      setLatency(times)
    } catch (e) {
      setError(`No internet: ${e}`)
    }
    setBusy(false)
  }

  const scan = async () => {
    setBusy(true)
    setError(undefined)
    try {
      setNets(await native.wifiScan())
    } catch (e) {
      setError(String(e))
    }
    setBusy(false)
  }

  const best = latency && Math.min(...latency)
  return (
    <>
      <p>Connect to your phone's hotspot (or the seller's Wi-Fi), then test the connection.</p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={ping}>Test connection</button>
        {isDesktop && <button disabled={busy} onClick={scan}>Scan networks</button>}
      </div>
      <Facts
        rows={[
          ['Online', online ? 'Yes' : 'No', online ? 'good' : 'bad'],
          ['Latency', latency ? `${best} ms best · ${latency.join(' / ')} ms` : null, best == null ? undefined : best < 100 ? 'good' : 'warn'],
        ]}
      />
      {error && <Notice kind="error">{error}</Notice>}
      {nets && (
        <Facts
          rows={
            nets.length
              ? nets.slice(0, 10).map((n, i) => [n.ssid || `(hidden ${i + 1})`, n.signalPct == null ? '?' : `${n.signalPct}%`])
              : [['Networks', 'None found', 'bad']]
          }
        />
      )}
      <Verdict result={result} setResult={setResult} suggestion={latency ? { status: 'pass', reason: 'connected to the internet' } : undefined} />
    </>
  )
}

export function Bluetooth({ result, setResult }: TestProps) {
  const [scan, setScan] = useState<BluetoothScan>()
  const [available, setAvailable] = useState<boolean>()
  const [picked, setPicked] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    navigator.bluetooth?.getAvailability().then(setAvailable, () => {})
  }, [])

  const run = async () => {
    setBusy(true)
    setError(undefined)
    try {
      if (isDesktop) setScan(await native.bluetoothScan(6))
      else setPicked((await navigator.bluetooth!.requestDevice({ acceptAllDevices: true })).name ?? 'Unnamed device')
    } catch (e) {
      // Closing the browser's picker throws NotFoundError; the list still proved the adapter works.
      setError(String(e))
    }
    setBusy(false)
  }

  const canRun = isDesktop || !!navigator.bluetooth
  return (
    <>
      <p>
        Turn Bluetooth on in Windows, then scan. Nearby phones, watches and headphones should appear. Best test:
        pair your own headphones and play the speaker test through them.
      </p>
      {!canRun && <Notice kind="warn">This browser can't use Bluetooth (use Chrome or Edge, or the desktop app).</Notice>}
      {available === false && <Notice kind="warn">The browser reports no Bluetooth adapter.</Notice>}
      <button className="primary" disabled={!canRun || busy} onClick={run}>
        {busy ? 'Scanning…' : isDesktop ? 'Scan for 6 seconds' : 'Open Bluetooth picker'}
      </button>
      {error && <Notice kind="warn">{error}</Notice>}
      {picked && <Facts rows={[['Found', picked, 'good']]} />}
      {scan && (
        <Facts
          rows={[
            ['Adapter', scan.adapter],
            ['Devices nearby', scan.devices.length, scan.devices.length ? 'good' : 'warn'],
            ...scan.devices
              .slice(0, 8)
              .map((d): [string, string] => [d.name ?? d.address, d.rssi == null ? '' : `${d.rssi} dBm`]),
          ]}
        />
      )}
      <Checks items={['Paired my own headphones / phone']} />
      <Verdict
        result={result}
        setResult={setResult}
        suggestion={scan?.devices.length || picked ? { status: 'pass', reason: 'devices found' } : undefined}
      />
    </>
  )
}
