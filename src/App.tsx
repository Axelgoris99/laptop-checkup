import { useEffect, useState } from 'react'
import { Notice, Verdict } from './components/ui'
import { isDesktop } from './core/native'
import type { Result, Status, TestDef } from './core/types'
import { TESTS } from './tests'

const STORAGE_KEY = 'laptop-checkup:results'
const ICON: Record<Status, string> = { pending: '○', pass: '✓', fail: '✗', skip: '–' }
const GROUPS = [...new Set(TESTS.map((t) => t.group))]

function loadResults(): Record<string, Result> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function reportText(results: Record<string, Result>) {
  const lines = TESTS.map((t) => {
    const r = results[t.id] ?? { status: 'pending' }
    return `${ICON[r.status]} ${t.title}${r.note ? ` — ${r.note}` : ''}`
  })
  return `Laptop checkup — ${new Date().toLocaleString()}\n\n${lines.join('\n')}\n`
}

function Summary({ results, onOpen, onReset }: {
  results: Record<string, Result>
  onOpen: (id: string) => void
  onReset: () => void
}) {
  const [copied, setCopied] = useState(false)
  const count = (s: Status) => TESTS.filter((t) => (results[t.id]?.status ?? 'pending') === s).length
  const fails = TESTS.filter((t) => results[t.id]?.status === 'fail')

  const copy = async () => {
    await navigator.clipboard.writeText(reportText(results))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <h2>Summary</h2>
      <div className="stats">
        <div className="stat good"><b>{count('pass')}</b> passed</div>
        <div className="stat bad"><b>{count('fail')}</b> failed</div>
        <div className="stat"><b>{count('skip')}</b> skipped</div>
        <div className="stat"><b>{count('pending')}</b> to do</div>
      </div>
      {fails.length > 0 ? (
        <Notice kind="error">
          Failed: {fails.map((t) => t.title).join(', ')}. Negotiate the price down, or walk away if it's the
          screen, a swollen battery, a BIOS password or a company lock.
        </Notice>
      ) : count('pending') === 0 ? (
        <Notice>Everything checked and nothing failed. Good to buy.</Notice>
      ) : null}
      <ul className="summary">
        {TESTS.map((t) => {
          const r = results[t.id] ?? { status: 'pending' }
          return (
            <li key={t.id} className={r.status} onClick={() => onOpen(t.id)}>
              <span className="status-icon">{ICON[r.status]}</span>
              <span>{t.title}</span>
              {r.note && <span className="muted"> — {r.note}</span>}
            </li>
          )
        })}
      </ul>
      <div className="row">
        <button className="primary" onClick={copy}>{copied ? 'Copied!' : 'Copy report'}</button>
        <button onClick={() => confirm('Clear every result?') && onReset()}>Start over</button>
      </div>
    </>
  )
}

function DesktopOnly({ test, result, setResult }: { test: TestDef; result: Result; setResult: (r: Result) => void }) {
  return (
    <>
      <Notice kind="warn">This check needs the desktop app. Here's how to do it by hand:</Notice>
      <ol className="manual">{test.manual?.map((m) => <li key={m}>{m}</li>)}</ol>
      <Verdict result={result} setResult={setResult} />
    </>
  )
}

export default function App() {
  const [results, setResults] = useState<Record<string, Result>>(loadResults)
  const [current, setCurrent] = useState<string>(TESTS[0].id)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
    } catch {
      // private mode: results just won't survive a reload
    }
  }, [results])

  const index = TESTS.findIndex((t) => t.id === current)
  const test = TESTS[index]
  const result = (test && results[test.id]) ?? { status: 'pending' as const }
  const setResult = (r: Result) => setResults((all) => ({ ...all, [test.id]: r }))
  const go = (i: number) => setCurrent(i >= TESTS.length ? 'summary' : TESTS[Math.max(0, i)].id)

  return (
    <div className="app">
      <aside>
        <h1>Laptop Checkup</h1>
        <p className={`mode ${isDesktop ? 'desktop' : 'web'}`}>
          {isDesktop ? 'Desktop app · all checks' : 'Web version · some checks need the app'}
        </p>
        <nav>
          {GROUPS.map((g) => (
            <div key={g}>
              <h3>{g}</h3>
              {TESTS.filter((t) => t.group === g).map((t) => {
                const s = results[t.id]?.status ?? 'pending'
                return (
                  <button
                    key={t.id}
                    className={`nav-item ${s} ${current === t.id ? 'active' : ''}`}
                    onClick={() => setCurrent(t.id)}
                  >
                    <span className="status-icon">{ICON[s]}</span>
                    {t.title}
                    {t.needs === 'desktop' && !isDesktop && <span className="badge">app</span>}
                  </button>
                )
              })}
            </div>
          ))}
          <button className={`nav-item summary-link ${current === 'summary' ? 'active' : ''}`} onClick={() => setCurrent('summary')}>
            Summary
          </button>
        </nav>
      </aside>
      <main>
        {test ? (
          <>
            <header>
              <p className="eyebrow">{test.group} · {index + 1}/{TESTS.length}</p>
              <h2>{test.title}</h2>
              <p className="muted">{test.hint}</p>
            </header>
            <section className="test" key={test.id}>
              {test.needs === 'desktop' && !isDesktop ? (
                <DesktopOnly test={test} result={result} setResult={setResult} />
              ) : (
                <test.Component result={result} setResult={setResult} />
              )}
            </section>
            <footer>
              <button disabled={index === 0} onClick={() => go(index - 1)}>← Previous</button>
              <button className="primary" onClick={() => go(index + 1)}>
                {index === TESTS.length - 1 ? 'Summary →' : 'Next →'}
              </button>
            </footer>
          </>
        ) : (
          <Summary results={results} onOpen={setCurrent} onReset={() => { setResults({}); setCurrent(TESTS[0].id) }} />
        )}
      </main>
    </div>
  )
}
