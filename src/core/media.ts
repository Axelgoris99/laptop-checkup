import { useEffect, useRef, useState } from 'react'

/** Holds a getUserMedia stream and stops its tracks on unmount or restart. */
export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string>()
  const current = useRef<MediaStream | null>(null)

  const stop = () => {
    current.current?.getTracks().forEach((t) => t.stop())
    current.current = null
    setStream(null)
  }

  const start = async (constraints: MediaStreamConstraints) => {
    stop()
    setError(undefined)
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints)
      current.current = s
      setStream(s)
    } catch (e) {
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    }
  }

  useEffect(() => stop, [])
  return { stream, error, start, stop }
}

/** Lists media devices of one kind; labels only appear after a permission grant. */
export function useDevices(kind: MediaDeviceKind, refreshKey: unknown) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    const load = () =>
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === kind)))
        .catch(() => setDevices([]))
    load()
    navigator.mediaDevices?.addEventListener('devicechange', load)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', load)
  }, [kind, refreshKey])
  return devices
}
