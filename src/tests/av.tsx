import { useEffect, useRef, useState } from 'react'
import { Checks, Facts, Notice, Verdict } from '../components/ui'
import { useDevices, useMediaStream } from '../core/media'
import type { TestProps } from '../core/types'

export function Speakers({ result, setResult }: TestProps) {
  const ctxRef = useRef<AudioContext | null>(null)
  const outputs = useDevices('audiooutput', null)
  const [playing, setPlaying] = useState<string>()

  useEffect(() => () => void ctxRef.current?.close(), [])

  const play = (name: string, pan: number, sweep = false) => {
    const ctx = (ctxRef.current ??= new AudioContext())
    const t = ctx.currentTime
    const dur = sweep ? 5 : 1.5
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(sweep ? 50 : 440, t)
    if (sweep) osc.frequency.exponentialRampToValueAtTime(12000, t + dur)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05)
    gain.gain.setValueAtTime(0.3, t + dur - 0.1)
    gain.gain.linearRampToValueAtTime(0, t + dur)
    osc.connect(gain).connect(new StereoPannerNode(ctx, { pan })).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur)
    setPlaying(name)
    osc.onended = () => setPlaying((p) => (p === name ? undefined : p))
  }

  const buttons: [string, number, boolean?][] = [
    ['Left', -1],
    ['Right', 1],
    ['Both', 0],
    ['Sweep 50 Hz → 12 kHz', 0, true],
  ]

  return (
    <>
      <p>
        Volume to ~70%. Each sound should come only from the side named. Then play the sweep at max volume
        and listen for rattling or crackling. Repeat with headphones in the jack.
      </p>
      <div className="row">
        {buttons.map(([name, pan, sweep]) => (
          <button key={name} className={playing === name ? 'primary' : ''} onClick={() => play(name, pan, sweep)}>
            ▶ {name}
          </button>
        ))}
      </div>
      {outputs.length > 0 && (
        <p className="muted">Outputs: {outputs.map((d) => d.label || 'unnamed').join(' · ')}</p>
      )}
      <Checks
        items={[
          'Left speaker',
          'Right speaker',
          'No rattle or crackle at max volume',
          'Headphones: left',
          'Headphones: right',
        ]}
      />
      <Verdict result={result} setResult={setResult} />
    </>
  )
}

export function Microphone({ result, setResult }: TestProps) {
  const { stream, error, start, stop } = useMediaStream()
  const inputs = useDevices('audioinput', stream)
  const [deviceId, setDeviceId] = useState('')
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<string>()

  useEffect(() => {
    if (!stream) return
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    let raf = 0
    const tick = () => {
      analyser.getFloatTimeDomainData(buf)
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length)
      const l = Math.min(1, rms * 4)
      setLevel(l)
      setPeak((p) => Math.max(p, l))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      void ctx.close()
    }
  }, [stream])

  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip) }, [clip])

  const begin = (id = deviceId) => {
    setPeak(0)
    void start({ audio: id ? { deviceId: { exact: id } } : true })
  }

  const record = () => {
    if (!stream) return
    const rec = new MediaRecorder(stream)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.onstop = () => {
      setClip(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })))
      setRecording(false)
    }
    rec.start()
    setRecording(true)
    setTimeout(() => rec.state === 'recording' && rec.stop(), 4000)
  }

  return (
    <>
      <p>Talk normally from where you'd sit. The bar should move with your voice. Record 4 seconds and play it back: it should sound clear, without hiss or crackle.</p>
      <div className="row">
        {stream ? <button onClick={stop}>Stop</button> : <button className="primary" onClick={() => begin()}>Start microphone</button>}
        {inputs.length > 1 && (
          <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); if (stream) begin(e.target.value) }}>
            <option value="">Default microphone</option>
            {inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
          </select>
        )}
        <button disabled={!stream || recording} onClick={record}>{recording ? 'Recording…' : '● Record 4 s'}</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {stream && (
        <div className="meter">
          <div className="meter-fill" style={{ width: `${level * 100}%` }} />
          <div className="meter-peak" style={{ left: `${peak * 100}%` }} />
        </div>
      )}
      {clip && <audio src={clip} controls autoPlay />}
      <Verdict result={result} setResult={setResult} suggestion={peak > 0.3 ? { status: 'pass', reason: 'it picks up sound' } : undefined} />
    </>
  )
}

export function Webcam({ result, setResult }: TestProps) {
  const { stream, error, start, stop } = useMediaStream()
  const cams = useDevices('videoinput', stream)
  const [deviceId, setDeviceId] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const begin = (id = deviceId) =>
    void start({ video: { ...(id ? { deviceId: { exact: id } } : {}), width: { ideal: 1920 } } })
  const settings = stream?.getVideoTracks()[0]?.getSettings()

  return (
    <>
      <p>Check the image is sharp, the colors look right, and the camera light turns on.</p>
      <div className="row">
        {stream ? <button onClick={stop}>Stop</button> : <button className="primary" onClick={() => begin()}>Start camera</button>}
        {cams.length > 1 && (
          <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); if (stream) begin(e.target.value) }}>
            <option value="">Default camera</option>
            {cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
          </select>
        )}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <video ref={videoRef} className="webcam" autoPlay playsInline muted hidden={!stream} />
      {settings && (
        <Facts rows={[['Resolution', `${settings.width} × ${settings.height} @ ${Math.round(settings.frameRate ?? 0)} fps`]]} />
      )}
      <Checks items={['Image sharp, no dead spots', 'Camera light turns on', 'Privacy shutter works (if any)']} />
      <Verdict result={result} setResult={setResult} suggestion={stream ? { status: 'pass', reason: 'camera streams' } : undefined} />
    </>
  )
}
