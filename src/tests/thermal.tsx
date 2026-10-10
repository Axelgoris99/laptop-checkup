import { useEffect, useRef, useState } from 'react'
import { Checks, Verdict } from '../components/ui'
import type { TestProps } from '../core/types'

const DURATION_S = 120
// Busy loop; each worker keeps one CPU thread at 100%.
const BURN = `let x = 0; for (;;) { x += Math.sqrt(Math.random() * x + 1); if (x > 1e12) x = 0 }`

export function Stress({ result, setResult }: TestProps) {
  const [elapsed, setElapsed] = useState<number>()
  const [threads, setThreads] = useState(0)
  const workers = useRef<Worker[]>([])
  const scriptUrl = useRef<string | null>(null)

  const stop = () => {
    workers.current.forEach((w) => w.terminate())
    workers.current = []
    if (scriptUrl.current) URL.revokeObjectURL(scriptUrl.current)
    scriptUrl.current = null
    setElapsed(undefined)
  }

  useEffect(() => stop, [])

  useEffect(() => {
    if (elapsed == null) return
    const t = setTimeout(() => (elapsed + 1 >= DURATION_S ? stop() : setElapsed(elapsed + 1)), 1000)
    return () => clearTimeout(t)
  }, [elapsed])

  const start = () => {
    const url = URL.createObjectURL(new Blob([BURN], { type: 'text/javascript' }))
    scriptUrl.current = url
    workers.current = Array.from({ length: navigator.hardwareConcurrency || 4 }, () => new Worker(url))
    setThreads(workers.current.length)
    setElapsed(0)
  }

  const running = elapsed != null
  return (
    <>
      <p>
        Runs every CPU thread at 100% for 2 minutes. The fan should spin up but stay a steady whoosh (no
        grinding or clicking), the keyboard area gets warm but not too hot to touch, and the laptop must
        not shut down or freeze.
      </p>
      <div className="row">
        {running ? (
          <button onClick={stop}>Stop</button>
        ) : (
          <button className="primary" onClick={start}>Start 2-minute load</button>
        )}
        {running && (
          <span>
            {elapsed}s / {DURATION_S}s · {threads} threads busy
          </span>
        )}
      </div>
      {running && (
        <div className="meter">
          <div className="meter-fill warn" style={{ width: `${(elapsed / DURATION_S) * 100}%` }} />
        </div>
      )}
      <Checks items={['Fan spins up, no grinding or clicking', 'Warm, not burning', 'No freeze or shutdown']} />
      <Verdict result={result} setResult={setResult} />
    </>
  )
}
