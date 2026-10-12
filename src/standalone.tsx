import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import type { Result } from './core/types'
import { TESTS } from './tests'

// Single-test pages (keyboard-test/, …): the text lives in the static HTML for
// search engines, and the test named by #tool's data-test mounts inside it.
const el = document.getElementById('tool')!
const test = TESTS.find((t) => t.id === el.dataset.test)!

// Entry file, not a module: fast refresh doesn't apply.
// oxlint-disable-next-line react/only-export-components
function Tool() {
  const [result, setResult] = useState<Result>({ status: 'pending' })
  return <test.Component result={result} setResult={setResult} />
}

createRoot(el).render(
  <StrictMode>
    <Tool />
  </StrictMode>,
)
