import { useEffect, useRef, useState } from 'react'
import { Checks, Facts, Notice, Verdict } from '../components/ui'
import type { TestProps } from '../core/types'

const PATTERNS = [
  { name: 'White', bg: '#ffffff', look: 'dark or dead pixels, color tint' },
  { name: 'Grey 50%', bg: '#808080', look: 'burn-in: faint shapes of taskbar, icons or windows' },
  { name: 'Grey 25%', bg: '#404040', look: 'blotches, uneven areas' },
  { name: 'Black', bg: '#000000', look: 'stuck bright pixels, light leaking from the edges' },
  { name: 'Red', bg: '#ff0000', look: 'pixels of another color' },
  { name: 'Green', bg: '#00ff00', look: 'pixels of another color' },
  { name: 'Blue', bg: '#0000ff', look: 'pixels of another color' },
  { name: 'Gradient', bg: 'linear-gradient(90deg, #000, #fff)', look: 'visible steps (banding)' },
]

function PatternOverlay({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  // Index whose label is showing; it fades a few seconds after each change.
  const [labelFor, setLabelFor] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef({ i, onClose })
  useEffect(() => {
    state.current = { i, onClose }
  })

  const goTo = (n: number) => {
    if (n >= PATTERNS.length) return state.current.onClose()
    const next = Math.max(0, n)
    setI(next)
    setLabelFor(next)
  }

  useEffect(() => {
    // Only close on leaving fullscreen if we actually entered it (StrictMode
    // remounts and blocked requests would otherwise close it instantly).
    let entered = false
    const onFsChange = () => {
      if (document.fullscreenElement) entered = true
      else if (entered) state.current.onClose()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    ref.current?.requestFullscreen?.().catch(() => {})
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { i, onClose } = state.current
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goTo(i - 1)
      else if (e.key === 'ArrowRight' || e.key === ' ') goTo(i + 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setLabelFor(-1), 2500)
    return () => clearTimeout(t)
  }, [i])

  const p = PATTERNS[i]
  return (
    <div ref={ref} className="pattern" style={{ background: p.bg }} onClick={() => goTo(i + 1)}>
      {labelFor === i && (
        <div className="pattern-label">
          {i + 1}/{PATTERNS.length} · <b>{p.name}</b> — look for {p.look}
          <br />
          <small>Click or → next · ← back · Esc quit</small>
        </div>
      )}
    </div>
  )
}

export function Screen({ result, setResult }: TestProps) {
  const [running, setRunning] = useState(false)
  return (
    <>
      <p>
        Shows full-screen colors one by one. Turn brightness to max, then look closely, especially on the
        grey screens: that's where OLED burn-in shows up.
      </p>
      <button className="primary" onClick={() => setRunning(true)}>
        Start screen test
      </button>
      {running && <PatternOverlay onClose={() => setRunning(false)} />}
      <Checks
        items={[
          'No dead or stuck pixels',
          'No burn-in on the grey screens',
          'No blotches or tint',
          'Brightness goes from min to max',
        ]}
      />
      <Verdict result={result} setResult={setResult} />
    </>
  )
}

export function ExternalDisplay({ result, setResult }: TestProps) {
  const [extended, setExtended] = useState(screen.isExtended)
  const [screens, setScreens] = useState<ScreenDetailed[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const t = setInterval(() => setExtended(screen.isExtended), 1000)
    return () => clearInterval(t)
  }, [])

  const details = async () => {
    try {
      setScreens((await window.getScreenDetails!()).screens)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <>
      <p>Plug a monitor or TV into HDMI (and USB-C if you have an adapter). The image should appear within a few seconds.</p>
      <Facts
        rows={[
          [
            'Second screen detected',
            extended == null ? 'Not exposed by this browser' : extended ? 'Yes' : 'No',
            extended ? 'good' : undefined,
          ],
        ]}
      />
      {window.getScreenDetails && (
        <button onClick={details}>List screens</button>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {screens && (
        <Facts
          rows={screens.map((s, i) => [
            `Screen ${i + 1}${s.isInternal ? ' (built-in)' : ''}`,
            `${s.label || 'Unnamed'} · ${Math.round(s.width * s.devicePixelRatio)} × ${Math.round(s.height * s.devicePixelRatio)}`,
          ])}
        />
      )}
      <Checks items={['Image on the HDMI screen', 'Image over USB-C (if you have an adapter)']} />
      <Verdict result={result} setResult={setResult} />
    </>
  )
}
