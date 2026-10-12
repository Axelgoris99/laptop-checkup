import { useEffect, useRef, useState } from 'react'
import { Checks, Verdict } from '../components/ui'
import type { TestProps } from '../core/types'

// Physical keys by `KeyboardEvent.code`, so the layout only changes the labels.
type Key = { code: string; label?: string; w?: number }
const k = (code: string, label?: string, w?: number): Key => ({ code, label, w })
const letters = (s: string) => [...s].map((c) => k(`Key${c}`))

const ROWS: Key[][] = [
  [k('Escape', 'Esc'), ...Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`, `F${i + 1}`)), k('Delete', 'Del')],
  [k('Backquote'), ...[...'1234567890'].map((d) => k(`Digit${d}`, d)), k('Minus'), k('Equal'), k('Backspace', '⌫', 2)],
  [k('Tab', 'Tab', 1.5), ...letters('QWERTYUIOP'), k('BracketLeft'), k('BracketRight'), k('Enter', 'Enter', 1.5)],
  [k('CapsLock', 'Caps', 1.75), ...letters('ASDFGHJKL'), k('Semicolon'), k('Quote'), k('Backslash'), k('Enter', '', 1.25)],
  [k('ShiftLeft', 'Shift', 1.25), k('IntlBackslash'), ...letters('ZXCVBNM'), k('Comma'), k('Period'), k('Slash'), k('ShiftRight', 'Shift', 2.75)],
  [
    k('ControlLeft', 'Ctrl', 1.5), k('MetaLeft', 'Win', 1.25), k('AltLeft', 'Alt', 1.25), k('Space', '', 5.5),
    k('AltRight', 'AltGr', 1.25), k('ControlRight', 'Ctrl', 1.25),
    k('ArrowLeft', '←'), k('ArrowUp', '↑'), k('ArrowDown', '↓'), k('ArrowRight', '→'),
  ],
]

const LABELS: Record<string, Record<string, string>> = {
  qwerty: {
    Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';',
    Quote: "'", Backslash: '#', IntlBackslash: '\\', Comma: ',', Period: '.', Slash: '/',
  },
  azerty: {
    Backquote: '²', Minus: ')', Equal: '=', BracketLeft: '^', BracketRight: '$', Semicolon: 'M',
    Quote: 'ù', Backslash: '*', IntlBackslash: '<', Comma: ';', Period: ':', Slash: '!',
    KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', KeyM: ',',
  },
}

const ALL_CODES = [...new Set(ROWS.flat().map((key) => key.code))]

export function Keyboard({ result, setResult }: TestProps) {
  const [layout, setLayout] = useState<'qwerty' | 'azerty'>(() =>
    navigator.language.startsWith('fr') ? 'azerty' : 'qwerty',
  )
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [down, setDown] = useState<Set<string>>(new Set())
  const [absent, setAbsent] = useState<Set<string>>(new Set())
  const [others, setOthers] = useState<string[]>([])

  useEffect(() => {
    const seen = (code: string) => {
      setPressed((p) => (p.has(code) ? p : new Set(p).add(code)))
      if (!ALL_CODES.includes(code)) setOthers((o) => (o.includes(code) ? o : [...o, code]))
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      e.preventDefault()
      seen(e.code)
      setDown((d) => new Set(d).add(e.code))
    }
    // Some keys (PrintScreen, media keys) only fire keyup.
    const onUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      seen(e.code)
      setDown((d) => {
        const next = new Set(d)
        next.delete(e.code)
        return next
      })
    }
    const onBlur = () => setDown(new Set())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const toggleAbsent = (code: string) =>
    setAbsent((a) => {
      const next = new Set(a)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const expected = ALL_CODES.filter((c) => !absent.has(c))
  const missing = expected.filter((c) => !pressed.has(c))
  const label = (key: Key) =>
    key.label ?? LABELS[layout][key.code] ?? key.code.replace(/^Key/, '')

  return (
    <>
      <p>
        Press every key once; each turns green. Keys held down stay highlighted, which reveals stuck keys.{' '}
        <b>Right-click</b> a key this laptop doesn't have to grey it out.
      </p>
      <div className="row">
        <div className="segmented">
          {(['azerty', 'qwerty'] as const).map((l) => (
            <button key={l} className={layout === l ? 'active' : ''} onClick={() => setLayout(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <span className={missing.length ? 'muted' : 'good'}>
          {expected.length - missing.length} / {expected.length} keys
        </span>
        <button onClick={() => { setPressed(new Set()); setOthers([]) }}>Reset</button>
      </div>
      <div className="keyboard">
        {ROWS.map((row, r) => (
          <div key={r} className="kb-row">
            {row.map((key, i) => (
              <div
                key={`${key.code}-${i}`}
                className={[
                  'key',
                  pressed.has(key.code) && 'pressed',
                  down.has(key.code) && 'down',
                  absent.has(key.code) && 'absent',
                ].filter(Boolean).join(' ')}
                style={{ flexGrow: key.w ?? 1 }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  toggleAbsent(key.code)
                }}
                title={key.code}
              >
                {label(key)}
              </div>
            ))}
          </div>
        ))}
      </div>
      {others.length > 0 && <p className="muted">Other keys seen: {others.join(', ')}</p>}
      {missing.length > 0 && missing.length <= 12 && (
        <p className="muted">Still to press: {missing.join(', ')}</p>
      )}
      <Checks items={['Keyboard backlight works (all levels)', 'No sticky or mushy keys', 'Fn shortcuts work (volume, brightness)']} />
      <Verdict
        result={result}
        setResult={setResult}
        suggestion={
          missing.length === 0
            ? { status: 'pass', reason: 'every key registered' }
            : undefined
        }
      />
    </>
  )
}

const GESTURES = [
  'Left click', 'Right click', 'Double click', 'Drag',
  'Scroll up', 'Scroll down', 'Scroll left', 'Scroll right', 'Pinch zoom',
] as const
type Gesture = (typeof GESTURES)[number]

export function Touchpad({ result, setResult }: TestProps) {
  const [done, setDone] = useState<Set<Gesture>>(new Set())
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const area = areaRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const mark = (g: Gesture) => setDone((d) => (d.has(g) ? d : new Set(d).add(g)))
    let last: { x: number; y: number } | null = null
    let dragStart: { x: number; y: number } | null = null

    const resize = () => {
      canvas.width = area.clientWidth
      canvas.height = area.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(area)

    const onMove = (e: PointerEvent) => {
      const p = { x: e.offsetX, y: e.offsetY }
      if (last) {
        ctx.strokeStyle = e.buttons ? '#22c55e' : '#3b82f6'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      last = p
      if (dragStart && e.buttons === 1 && Math.hypot(p.x - dragStart.x, p.y - dragStart.y) > 60) mark('Drag')
    }
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) {
        mark('Left click')
        dragStart = { x: e.offsetX, y: e.offsetY }
      }
    }
    const onUp = () => (dragStart = null)
    const onLeave = () => (last = null)
    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      mark('Right click')
    }
    const onDbl = () => mark('Double click')
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) return mark('Pinch zoom') // trackpad pinch arrives as ctrl+wheel
      if (e.deltaY < 0) mark('Scroll up')
      if (e.deltaY > 0) mark('Scroll down')
      if (e.deltaX < 0) mark('Scroll left')
      if (e.deltaX > 0) mark('Scroll right')
    }

    area.addEventListener('pointermove', onMove)
    area.addEventListener('pointerdown', onDown)
    area.addEventListener('pointerup', onUp)
    area.addEventListener('pointerleave', onLeave)
    area.addEventListener('contextmenu', onContext)
    area.addEventListener('dblclick', onDbl)
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      area.removeEventListener('pointermove', onMove)
      area.removeEventListener('pointerdown', onDown)
      area.removeEventListener('pointerup', onUp)
      area.removeEventListener('pointerleave', onLeave)
      area.removeEventListener('contextmenu', onContext)
      area.removeEventListener('dblclick', onDbl)
      area.removeEventListener('wheel', onWheel)
    }
  }, [])

  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setDone(new Set())
  }

  return (
    <>
      <p>
        Inside the box: move across every corner (the line should never jump or break), click, right-click,
        double-click, drag, scroll with two fingers in all directions, and pinch.
      </p>
      <div className="chips">
        {GESTURES.map((g) => (
          <span key={g} className={`chip ${done.has(g) ? 'good' : ''}`}>{g}</span>
        ))}
        <button onClick={clear}>Clear</button>
      </div>
      <div ref={areaRef} className="touch-area">
        <canvas ref={canvasRef} />
      </div>
      <Checks items={['Physical click works in every corner', 'Number pad lights up and types (ZenBook NumberPad)']} />
      <Verdict
        result={result}
        setResult={setResult}
        suggestion={done.size === GESTURES.length ? { status: 'pass', reason: 'every gesture registered' } : undefined}
      />
    </>
  )
}
