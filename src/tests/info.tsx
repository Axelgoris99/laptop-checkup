import { useEffect, useState } from 'react'
import { Checks, Facts, Loading, Notice, Verdict, type Tone } from '../components/ui'
import { formatBytes, isDesktop, native } from '../core/native'
import type { TestProps } from '../core/types'
import { useAsync } from '../core/useAsync'

const gib = (bytes: number) => `${(bytes / 2 ** 30).toFixed(1)} GB`
const yesNo = (v: boolean | null | undefined) => (v == null ? null : v ? 'Yes' : 'No')

function webGpu(): string | undefined {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return undefined
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
  } catch {
    return undefined
  }
}

export function Specs({ result, setResult }: TestProps) {
  const sys = useAsync(native.systemInfo, isDesktop)
  const dpr = window.devicePixelRatio
  const screenRes = `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`

  return (
    <>
      <Notice>Compare each line with the ad. Anything lower than advertised is a reason to negotiate.</Notice>
      {isDesktop ? (
        sys.loading ? (
          <Loading what="system info" />
        ) : sys.error ? (
          <Notice kind="error">{sys.error}</Notice>
        ) : (
          sys.data && (
            <Facts
              rows={[
                ['Processor', sys.data.cpuBrand],
                ['Cores / threads', `${sys.data.cpuCores ?? '?'} / ${sys.data.cpuThreads}`],
                ['RAM', <>{gib(sys.data.ramBytes)} <span className="muted">(16 GB shows as ~15.x)</span></>],
                ['Graphics', sys.data.gpus.join(', ') || webGpu()],
                ['Screen', `${screenRes} (scaling ${Math.round(dpr * 100)}%)`],
                ['OS', sys.data.os],
                [
                  'Disks',
                  sys.data.disks
                    .filter((d) => !d.removable)
                    .map((d) => `${d.mount} ${formatBytes(d.totalBytes)} ${d.kind}`)
                    .join(' · '),
                ],
              ]}
            />
          )
        )
      ) : (
        <>
          <Facts
            rows={[
              ['CPU threads', navigator.hardwareConcurrency],
              [
                'RAM',
                navigator.deviceMemory
                  ? `≥ ${navigator.deviceMemory} GB (rough browser estimate)`
                  : 'Not exposed by this browser',
              ],
              ['Graphics', webGpu()],
              ['Screen', `${screenRes} (scaling ${Math.round(dpr * 100)}%)`],
              ['Browser', navigator.userAgent],
            ]}
          />
          <Notice kind="warn">
            The browser can't see the exact CPU model, RAM or disk. On Windows, check{' '}
            <b>Settings → System → About</b> and File Explorer → This PC.
          </Notice>
        </>
      )}
      <Verdict result={result} setResult={setResult} />
    </>
  )
}

const healthTone = (pct: number): Tone => (pct >= 80 ? 'good' : pct >= 70 ? 'warn' : 'bad')

export function Battery({ result, setResult }: TestProps) {
  const bats = useAsync(native.batteryInfo, isDesktop)
  const [web, setWeb] = useState<{ level: number; charging: boolean }>()

  useEffect(() => {
    if (isDesktop || !navigator.getBattery) return
    let bm: BatteryManager | undefined
    const update = () => bm && setWeb({ level: bm.level, charging: bm.charging })
    navigator.getBattery().then((b) => {
      bm = b
      update()
      b.addEventListener('levelchange', update)
      b.addEventListener('chargingchange', update)
    })
    return () => {
      bm?.removeEventListener('levelchange', update)
      bm?.removeEventListener('chargingchange', update)
    }
  }, [])

  const worst = bats.data?.length ? Math.min(...bats.data.map((b) => b.healthPct)) : undefined
  const suggestion =
    worst == null
      ? undefined
      : worst >= 70
        ? { status: 'pass' as const, reason: `${worst.toFixed(0)}% of original capacity` }
        : { status: 'fail' as const, reason: `only ${worst.toFixed(0)}% left — plan a new battery` }

  return (
    <>
      {isDesktop ? (
        bats.loading ? (
          <Loading what="battery" />
        ) : bats.error ? (
          <Notice kind="error">{bats.error}</Notice>
        ) : bats.data?.length === 0 ? (
          <Notice kind="error">No battery detected.</Notice>
        ) : (
          bats.data?.map((b, i) => (
            <Facts
              key={i}
              rows={[
                ['Health', `${b.healthPct.toFixed(0)}% of original capacity`, healthTone(b.healthPct)],
                ['Capacity now / new', `${b.energyFullWh.toFixed(1)} Wh / ${b.energyDesignWh.toFixed(1)} Wh`],
                ['Charge cycles', b.cycleCount],
                ['Charge', `${b.chargePct.toFixed(0)}% (${b.state})`],
                ['Model', [b.vendor, b.model, b.technology].filter(Boolean).join(' · ')],
              ]}
            />
          ))
        )
      ) : (
        <>
          {web ? (
            <Facts
              rows={[
                ['Charge', `${Math.round(web.level * 100)}%`],
                ['Plugged in', web.charging ? 'Yes' : 'No'],
              ]}
            />
          ) : (
            <Notice kind="warn">This browser doesn't expose the battery (use Chrome or Edge).</Notice>
          )}
          <Notice kind="warn">
            Wear can't be read from a browser. On Windows: right-click Start → <b>Terminal</b> →{' '}
            <code>powercfg /batteryreport</code>, open the HTML file it names, and compare{' '}
            <b>Full charge capacity</b> with <b>Design capacity</b>. 70% or more is fine.
          </Notice>
        </>
      )}
      <Checks items={['Unplugged, the laptop keeps running and the % stays stable', 'No bulge under the touchpad or bottom cover']} />
      <Verdict result={result} setResult={setResult} suggestion={suggestion} />
    </>
  )
}

export function Storage({ result, setResult }: TestProps) {
  const disks = useAsync(native.storageHealth)
  const bad = disks.data?.find((d) => (d.health && d.health !== 'Healthy') || (d.wearPct ?? 0) > 30)
  const suggestion = disks.data?.length
    ? bad
      ? { status: 'fail' as const, reason: `${bad.name}: ${bad.health}, ${bad.wearPct ?? '?'}% worn` }
      : { status: 'pass' as const, reason: 'drives report healthy' }
    : undefined

  return (
    <>
      {disks.loading ? (
        <Loading what="drive health" />
      ) : disks.error ? (
        <Notice kind="error">{disks.error}</Notice>
      ) : (
        disks.data?.map((d) => (
          <div key={d.name} className="card">
            <h4>{d.name}</h4>
            <Facts
              rows={[
                ['Health', d.health, d.health == null ? undefined : d.health === 'Healthy' ? 'good' : 'bad'],
                [
                  'Endurance used',
                  d.wearPct == null ? null : `${d.wearPct}%`,
                  d.wearPct == null ? undefined : d.wearPct <= 10 ? 'good' : d.wearPct <= 30 ? 'warn' : 'bad',
                ],
                ['Size', d.sizeBytes ? formatBytes(d.sizeBytes) : null],
                ['Type', [d.mediaType, d.bus].filter(Boolean).join(' · ')],
                ['Temperature', d.temperatureC == null ? null : `${d.temperatureC} °C`],
                ['Powered on', d.powerOnHours == null ? null : `${d.powerOnHours} h`],
                ['Uncorrected errors', d.mediaErrors, d.mediaErrors ? 'bad' : undefined],
              ]}
            />
          </div>
        ))
      )}
      {disks.data?.some((d) => d.wearPct == null || d.health == null) && (
        <Notice kind="warn">
          Health details need admin rights. On Windows: close the app, right-click it →{' '}
          <b>Run as administrator</b> (or use CrystalDiskInfo). On Linux: run it with sudo.
        </Notice>
      )}
      <Verdict result={result} setResult={setResult} suggestion={suggestion} />
    </>
  )
}

const passwordTone = (s: string | null): Tone =>
  s === 'Enabled' ? 'bad' : s === 'Disabled' ? 'good' : 'warn'

export function Firmware({ result, setResult }: TestProps) {
  const fw = useAsync(native.firmwareInfo)
  return (
    <>
      {fw.loading ? (
        <Loading what="firmware" />
      ) : fw.error ? (
        <Notice kind="error">{fw.error}</Notice>
      ) : (
        fw.data && (
          <Facts
            rows={[
              ['Maker / model', [fw.data.manufacturer, fw.data.model].filter(Boolean).join(' ')],
              ['Serial number', fw.data.serial],
              ['BIOS', [fw.data.biosVendor, fw.data.biosVersion, fw.data.biosDate].filter(Boolean).join(' · ')],
              ['BIOS admin password', fw.data.adminPassword, passwordTone(fw.data.adminPassword)],
              ['Power-on password', fw.data.powerOnPassword, passwordTone(fw.data.powerOnPassword)],
            ]}
          />
        )
      )}
      <Notice>
        Many laptops report the password status as “Unknown”. The only sure test: restart, press{' '}
        <b>F2</b> (or Del / F10), and check the BIOS opens without asking for a password.
      </Notice>
      <Checks items={['Serial matches the sticker under the laptop', 'BIOS opens without a password']} />
      <Verdict result={result} setResult={setResult} />
    </>
  )
}

export function WindowsLock({ result, setResult }: TestProps) {
  const win = useAsync(native.windowsStatus)
  const d = win.data
  const company = d && (d.azureAdJoined || d.domainJoined || d.enterpriseJoined || d.autopilotTenant || d.mdmProviders.length > 0)
  const suggestion = d
    ? company
      ? { status: 'fail' as const, reason: 'still tied to a company — it may lock after a reset' }
      : d.activated === false
        ? { status: 'fail' as const, reason: 'Windows is not activated' }
        : { status: 'pass' as const, reason: 'activated and not managed by a company' }
    : undefined
  const flag = (v: boolean | null): Tone => (v ? 'bad' : v === false ? 'good' : undefined)

  return (
    <>
      {win.loading ? (
        <Loading what="Windows status (a few seconds)" />
      ) : win.error ? (
        <Notice kind="error">{win.error}</Notice>
      ) : (
        d && (
          <Facts
            rows={[
              ['Activated', yesNo(d.activated), d.activated ? 'good' : 'bad'],
              ['License', d.licenseName],
              ['Joined to a company (Entra ID)', yesNo(d.azureAdJoined), flag(d.azureAdJoined)],
              ['Joined to a domain', yesNo(d.domainJoined), flag(d.domainJoined)],
              ['Autopilot (company-owned)', d.autopilotTenant ?? 'No', d.autopilotTenant ? 'bad' : 'good'],
              ['Device management (Intune…)', d.mdmProviders.join(', ') || 'None', d.mdmProviders.length ? 'bad' : 'good'],
            ]}
          />
        )
      )}
      <Notice>
        A company-managed laptop can lock itself after a reset and ask for a work account. If anything
        here is red, ask the seller for proof it was released by the company, or walk away.
      </Notice>
      <Verdict result={result} setResult={setResult} suggestion={suggestion} />
    </>
  )
}
