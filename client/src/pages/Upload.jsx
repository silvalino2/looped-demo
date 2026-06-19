import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/ui/Button'
import api from '../lib/api'

const STAGES_UPLOAD = [
  { key: 'uploading', label: 'Uploading to cloud' },
  { key: 'downloading', label: 'Fetching video' },
  { key: 'extracting', label: 'Extracting audio' },
  { key: 'segmenting', label: 'Segmenting clips' },
  { key: 'transcribing', label: 'Transcribing & adding subtitles' },
  { key: 'rendering', label: 'Rendering clips' },
  { key: 'done', label: 'Complete' }
]

const STAGES_YOUTUBE = [
  { key: 'downloading', label: 'Downloading from YouTube' },
  { key: 'extracting', label: 'Extracting audio' },
  { key: 'segmenting', label: 'Segmenting clips' },
  { key: 'transcribing', label: 'Transcribing & adding subtitles' },
  { key: 'rendering', label: 'Rendering clips' },
  { key: 'done', label: 'Complete' }
]

const STAGE_MAP_UPLOAD = { downloading: 1, extracting: 2, segmenting: 3, transcribing: 4, rendering: 5, completed: 6 }
const STAGE_MAP_YOUTUBE = { downloading: 0, extracting: 1, segmenting: 2, transcribing: 3, rendering: 4, completed: 5 }

const CLIP_DURATION_PRESETS = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: 'Custom', value: 'custom' }
]

const MAX_CLIPS_PRESETS = [3, 5, 8, 12, 20]

const fmtTime = (s) => {
  if (!s && s !== 0) return ''
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const parseTime = (val) => {
  if (!val) return 0
  if (val.includes(':')) {
    const [m, s] = val.split(':').map(Number)
    return (m || 0) * 60 + (s || 0)
  }
  return parseInt(val) || 0
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      border: `1px solid ${active ? 'rgba(134,239,172,0.4)' : '#1e1e1e'}`,
      cursor: 'pointer', transition: 'all 180ms',
      background: active ? 'rgba(134,239,172,0.1)' : 'transparent',
      color: active ? '#86efac' : 'rgba(255,255,255,0.4)',
      fontFamily: "'DM Sans', sans-serif"
    }}>{children}</button>
  )
}

function SettingsPanel({ settings, onChange }) {
  const [customDuration, setCustomDuration] = useState('')
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const isCustom = settings.clipDurationPreset === 'custom'

  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: '22px 24px', marginBottom: 16 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
        Clip settings
      </h3>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 10 }}>Clip length</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CLIP_DURATION_PRESETS.map(p => (
            <ToggleButton key={p.value} active={settings.clipDurationPreset === p.value}
              onClick={() => {
                if (p.value === 'custom') onChange({ clipDurationPreset: 'custom' })
                else onChange({ clipDurationPreset: p.value, clipDuration: p.value })
              }}>{p.label}</ToggleButton>
          ))}
        </div>
        {isCustom && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min="5" max="600" placeholder="e.g. 45" value={customDuration}
              onChange={e => { setCustomDuration(e.target.value); const n = parseInt(e.target.value); if (n > 0) onChange({ clipDuration: n }) }}
              style={{ width: 100, padding: '8px 12px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'rgba(134,239,172,0.4)'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>seconds</span>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 10 }}>Max clips</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MAX_CLIPS_PRESETS.map(n => (
            <ToggleButton key={n} active={settings.maxClips === n} onClick={() => onChange({ maxClips: n })}>{n}</ToggleButton>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 10 }}>
          Time range <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(optional)</span>
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {[['FROM', startInput, v => { setStartInput(v); onChange({ startAt: parseTime(v) }) }, '0:00'],
            ['TO', endInput, v => { setEndInput(v); onChange({ endAt: parseTime(v) || undefined }) }, 'end']
          ].map(([lbl, val, setter, ph]) => (
            <div key={lbl} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>{lbl}</span>
              <input type="text" placeholder={ph} value={val} onChange={e => setter(e.target.value)}
                style={{ width: 80, padding: '8px 12px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center' }}
                onFocus={e => e.target.style.borderColor = 'rgba(134,239,172,0.4)'}
                onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', paddingTop: 18 }}>m:ss or seconds</p>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: '10px 14px', background: 'rgba(134,239,172,0.04)', border: '1px solid rgba(134,239,172,0.1)', borderRadius: 10 }}>
        <p style={{ fontSize: 12, color: 'rgba(134,239,172,0.7)', fontFamily: "'DM Mono', monospace" }}>
          Up to {settings.maxClips} clips · {isCustom ? (settings.clipDuration || '?') : settings.clipDuration}s each
          {settings.startAt > 0 || settings.endAt ? ` · ${fmtTime(settings.startAt)} → ${settings.endAt ? fmtTime(settings.endAt) : 'end'}` : ' · full video'}
        </p>
      </div>
    </div>
  )
}

export default function Upload() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [ytUrl, setYtUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState({ clipDurationPreset: 60, clipDuration: 60, maxClips: 8, startAt: 0, endAt: undefined })

  const updateSettings = (patch) => setSettings(prev => ({ ...prev, ...patch }))

  const handleFile = (f) => { if (!f) return; setFile(f); setError(null) }
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }, [])

  const pollStatus = async (jobId, stageMap) => {
    while (true) {
      await new Promise(r => setTimeout(r, 2500))
      const res = await api.get(`/jobs/${jobId}/status`)
      const { status, error_message } = res.data
      if (stageMap[status] !== undefined) setCurrentStage(stageMap[status])
      if (status === 'completed') return
      if (status === 'failed') throw new Error(error_message || 'Processing failed')
    }
  }

  // Upload directly to Cloudinary, then send URL to server
  const handleProcessFile = async () => {
    if (!file) return
    setError(null)
    setProcessing(true)
    setCurrentStage(0)

    try {
      // 1. Get upload signature from server
      const signRes = await api.post('/jobs/cloudinary-sign', {})
      const { signature, timestamp, folder, cloudName, apiKey } = signRes.data

      // 2. Upload directly to Cloudinary from browser
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', apiKey)
      formData.append('timestamp', timestamp)
      formData.append('signature', signature)
      formData.append('folder', folder)
      formData.append('resource_type', 'video')

      const uploadRes = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText))
          else reject(new Error(`Cloudinary upload failed: ${xhr.responseText}`))
        }
        xhr.onerror = () => reject(new Error('Upload failed — check connection'))
        xhr.send(formData)
      })

      const cloudinaryUrl = uploadRes.secure_url
      setCurrentStage(1)

      // 3. Send Cloudinary URL to our server
      const jobRes = await api.post('/jobs/cloudinary', {
        url: cloudinaryUrl,
        originalFilename: file.name,
        clipDuration: settings.clipDuration,
        maxClips: settings.maxClips,
        startAt: settings.startAt || 0,
        endAt: settings.endAt
      })

      await pollStatus(jobRes.data.jobId, STAGE_MAP_UPLOAD)
      setTimeout(() => navigate(`/clips/${jobRes.data.jobId}`), 600)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong')
      setProcessing(false)
    }
  }

  const handleProcessYoutube = async () => {
    if (!ytUrl.trim()) return
    setError(null)
    setProcessing(true)
    setCurrentStage(0)

    try {
      const res = await api.post('/jobs/youtube', {
        url: ytUrl.trim(),
        clipDuration: settings.clipDuration,
        maxClips: settings.maxClips,
        startAt: settings.startAt || 0,
        endAt: settings.endAt
      })
      await pollStatus(res.data.jobId, STAGE_MAP_YOUTUBE)
      setTimeout(() => navigate(`/clips/${res.data.jobId}`), 600)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong')
      setProcessing(false)
    }
  }

  const STAGES = mode === 'youtube' ? STAGES_YOUTUBE : STAGES_UPLOAD
  const canSubmit = mode === 'file' ? !!file : !!ytUrl.trim()

  return (
    <AppLayout>
      <div style={{ padding: 'clamp(28px, 4vw, 48px)', maxWidth: 720 }}>
        <div style={{ marginBottom: 32, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>New video</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Upload a file or paste a YouTube link. Gets subtitles, captions & hashtags automatically.
          </p>
        </div>

        {!processing && (
          <div style={{ animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 60ms both' }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: 4, width: 'fit-content' }}>
              {[['file', '⬆ Upload file'], ['youtube', '▶ YouTube URL']].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(null) }}
                  style={{
                    padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                    border: 'none', cursor: 'pointer', transition: 'all 200ms',
                    background: mode === m ? 'rgba(134,239,172,0.12)' : 'transparent',
                    color: mode === m ? '#86efac' : 'rgba(255,255,255,0.4)',
                    fontFamily: "'DM Sans', sans-serif"
                  }}>{label}</button>
              ))}
            </div>

            {mode === 'file' && (
              <div
                onClick={() => !file && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragging ? '#86efac' : file ? 'rgba(134,239,172,0.4)' : '#1e1e1e'}`,
                  borderRadius: 20, padding: '48px 40px', textAlign: 'center',
                  cursor: file ? 'default' : 'pointer', transition: 'all 250ms',
                  background: dragging ? 'rgba(134,239,172,0.04)' : file ? 'rgba(134,239,172,0.03)' : '#0d0d0d',
                  marginBottom: 20
                }}
              >
                <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])} />
                {file ? (
                  <div>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>🎬</div>
                    <p style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 4 }}>{file.name}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                    <button onClick={e => { e.stopPropagation(); setFile(null) }}
                      style={{ marginTop: 12, fontSize: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 22 }}>⬆</div>
                    <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, letterSpacing: '-0.01em' }}>Drop your video here</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>or click to browse · any format · no size limit</p>
                  </>
                )}
              </div>
            )}

            {mode === 'youtube' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>YouTube URL</label>
                <input type="url" value={ytUrl}
                  onChange={e => { setYtUrl(e.target.value); setError(null) }}
                  placeholder="https://youtube.com/watch?v=..."
                  onKeyDown={e => e.key === 'Enter' && ytUrl.trim() && handleProcessYoutube()}
                  style={{ width: '100%', padding: '13px 16px', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(134,239,172,0.4)'}
                  onBlur={e => e.target.style.borderColor = '#2a2a2a'} />
              </div>
            )}

            <SettingsPanel settings={settings} onChange={updateSettings} />

            {error && (
              <div style={{ marginBottom: 14, padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}

            <Button size="lg" fullWidth onClick={mode === 'file' ? handleProcessFile : handleProcessYoutube} disabled={!canSubmit}>
              {mode === 'file' ? 'Generate clips →' : 'Download & generate clips →'}
            </Button>
          </div>
        )}

        {/* Processing */}
        {processing && (
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 20, padding: '40px 36px', animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px', border: '2px solid rgba(134,239,172,0.15)', borderTopColor: '#86efac', animation: 'spin 0.9s linear infinite' }} />
              <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6 }}>Processing your video</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {settings.clipDuration}s clips · {settings.maxClips} max · subtitles + captions included
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {STAGES.map((s, i) => {
                const done = i < currentStage
                const active = i === currentStage
                return (
                  <div key={s.key} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, flexShrink: 0, transition: 'all 300ms',
                        background: done ? '#86efac' : active ? 'rgba(134,239,172,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${done ? '#86efac' : active ? '#86efac' : '#1e1e1e'}`,
                        color: done ? '#0a0a0a' : active ? '#86efac' : 'rgba(255,255,255,0.25)'
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{ width: 1, height: 28, margin: '4px 0', background: done ? 'rgba(134,239,172,0.4)' : 'rgba(255,255,255,0.06)', transition: 'background 500ms' }} />
                      )}
                    </div>
                    <div style={{ paddingTop: 5, paddingBottom: i < STAGES.length - 1 ? 24 : 0 }}>
                      <p style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: done ? 'rgba(255,255,255,0.5)' : active ? '#fff' : 'rgba(255,255,255,0.25)', transition: 'all 300ms', letterSpacing: '-0.01em' }}>
                        {s.label}
                        {active && s.key === 'uploading' && uploadProgress > 0 && ` · ${uploadProgress}%`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
