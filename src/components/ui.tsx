import { useState, type ReactNode } from 'react'
import type { Result, Status } from '../core/types'

const VERDICTS: { status: Status; label: string }[] = [
  { status: 'pass', label: '✓ Pass' },
  { status: 'fail', label: '✗ Fail' },
  { status: 'skip', label: 'Skip' },
]

/** Pass / fail / skip buttons plus a free-text note, at the bottom of each test. */
export function Verdict({
  result,
  setResult,
  suggestion,
}: {
  result: Result
  setResult: (r: Result) => void
  suggestion?: { status: Status; reason: string }
}) {
  return (
    <div className="verdict">
      {suggestion && result.status === 'pending' && (
        <p className={`suggestion ${suggestion.status}`}>
          Suggested: <b>{suggestion.status}</b> — {suggestion.reason}
        </p>
      )}
      <div className="verdict-row">
        {VERDICTS.map((v) => (
          <button
            key={v.status}
            className={`verdict-btn ${v.status} ${result.status === v.status ? 'active' : ''}`}
            onClick={() =>
              setResult({ ...result, status: result.status === v.status ? 'pending' : v.status })
            }
          >
            {v.label}
          </button>
        ))}
        <input
          className="note"
          placeholder="Note (e.g. “72% battery”, “E key sticky”)"
          value={result.note ?? ''}
          onChange={(e) => setResult({ ...result, note: e.target.value })}
        />
      </div>
    </div>
  )
}

export type Tone = 'good' | 'warn' | 'bad' | undefined

/** Two-column key/value table. */
export function Facts({ rows }: { rows: [string, ReactNode, Tone?][] }) {
  return (
    <table className="facts">
      <tbody>
        {rows.map(([k, v, tone]) => (
          <tr key={k}>
            <th>{k}</th>
            <td className={tone}>{v ?? <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Manual sub-checks the user ticks by hand (e.g. "left speaker"). */
export function Checks({ items }: { items: string[] }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const toggle = (item: string) =>
    setDone((d) => {
      const next = new Set(d)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  return (
    <ul className="checks">
      {items.map((item) => (
        <li key={item}>
          <label>
            <input type="checkbox" checked={done.has(item)} onChange={() => toggle(item)} />
            {item}
          </label>
        </li>
      ))}
    </ul>
  )
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return <div className={`notice ${kind}`}>{children}</div>
}

export function Loading({ what }: { what: string }) {
  return <p className="muted">Reading {what}…</p>
}
