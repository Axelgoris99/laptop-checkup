import type { FC } from 'react'

export type Status = 'pending' | 'pass' | 'fail' | 'skip'

export interface Result {
  status: Status
  note?: string
}

export interface TestProps {
  result: Result
  setResult: (r: Result) => void
}

export interface TestDef {
  id: string
  title: string
  group: string
  /** 'desktop' tests need the Tauri app (native APIs the browser lacks). */
  needs: 'any' | 'desktop'
  /** One-line "what to look for", shown under the title. */
  hint: string
  /** How to check by hand when the test can't run here (web version). */
  manual?: string[]
  Component: FC<TestProps>
}
