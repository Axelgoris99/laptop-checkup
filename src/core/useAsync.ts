import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
  reload: () => void
}

/** Runs `fn` on mount (when `enabled`) and on `reload()`. */
export function useAsync<T>(fn: () => Promise<T>, enabled = true): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: enabled,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let live = true
    setState((s) => ({ ...s, loading: true, error: undefined }))
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: String(e?.message ?? e), loading: false }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
