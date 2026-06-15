import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/ui/Button'
import api from '../lib/api'

export default function ClipDetail() {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [clips, setClips] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeClip, setActiveClip] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/jobs/${jobId}`),
      api.get(`/jobs/${jobId}/clips`)
    ]).then(([jobRes, clipsRes]) => {
      setJob(jobRes.data.job)
      const c = clipsRes.data.clips || []
      setClips(c)
      if (c.length > 0) setActiveClip(c[0])
    }).catch(console.error).finally(() => setLoading(false))
  }, [jobId])

  const copyCaption = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const label = job?.youtube_url
    ? `YouTube · ${job.youtube_url.slice(0, 50)}${job.youtube_url.length > 50 ? '…' : ''}`
    : (job?.original_filename || 'Clips')

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(134,239,172,0.2)', borderTopColor: '#86efac', animation: 'spin 0.8s linear infinite' }} />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div style={{ padding: 'clamp(28px, 4vw, 48px)', maxWidth: 1100 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link to="/history" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>History</Link>
          <span>/</span>
          <span style={{ color: '#fff', fontWeight: 500 }}>{label}</span>
        </div>

        <div style={{ marginBottom: 32, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 4 }}>
            {label}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {clips.length} clip{clips.length !== 1 ? 's' : ''} generated
            {job?.created_at && ` · ${new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
          </p>
        </div>

        {clips.length === 0 ? (
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: '56px 40px', textAlign: 'center' }}>
            {['pending','extracting','transcribing','segmenting','rendering','downloading'].includes(job?.status) ? (
              <>
                <div style={{ width: 40, height: 40, borderRadius: '50%', margin: '0 auto 20px', border: '2px solid rgba(134,239,172,0.2)', borderTopColor: '#86efac', animation: 'spin 0.9s linear infinite' }} />
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Still processing</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Check back in a moment</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No clips found</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
                  {job?.status === 'failed' ? `Failed: ${job.error_message || 'unknown error'}` : 'No clips were generated'}
                </p>
                <Link to="/"><Button size="md">Try another video</Button></Link>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 80ms both' }}>
            {/* Clip list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                All clips
              </p>
              {clips.map((clip, i) => (
                <div
                  key={clip.id}
                  onClick={() => setActiveClip(clip)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    background: activeClip?.id === clip.id ? 'rgba(134,239,172,0.08)' : '#0d0d0d',
                    border: `1px solid ${activeClip?.id === clip.id ? 'rgba(134,239,172,0.25)' : '#1a1a1a'}`,
                    transition: 'all 200ms'
                  }}
                  onMouseEnter={e => activeClip?.id !== clip.id && (e.currentTarget.style.background = '#111')}
                  onMouseLeave={e => activeClip?.id !== clip.id && (e.currentTarget.style.background = '#0d0d0d')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: activeClip?.id === clip.id ? '#86efac' : '#fff' }}>
                      Clip {i + 1}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono', monospace" }}>
                      {clip.duration_seconds ? `${Math.round(clip.duration_seconds)}s` : '—'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {clip.start_time !== undefined ? `${Math.round(clip.start_time)}s – ${Math.round(clip.end_time)}s` : 'Auto-cut'}
                  </p>
                </div>
              ))}
            </div>

            {/* Active clip */}
            {activeClip && (
              <div>
                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ background: '#000', display: 'flex', justifyContent: 'center', maxHeight: 420, overflow: 'hidden' }}>
                    {activeClip.url ? (
                      <video key={activeClip.id} controls playsInline preload="metadata"
                        style={{ maxHeight: 420, maxWidth: '100%', display: 'block' }}>
                        <source src={activeClip.url} type="video/mp4" />
                      </video>
                    ) : (
                      <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, width: '100%' }}>
                        <span style={{ fontSize: 32 }}>🎬</span>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Preview unavailable</p>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '20px 24px', borderTop: '1px solid #1a1a1a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                          {activeClip.filename || `clip-${activeClip.id}.mp4`}
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Ready to post</p>
                      </div>
                      {activeClip.url && (
                        <a href={activeClip.url} download={activeClip.filename || `clip-${activeClip.id}.mp4`}>
                          <Button size="md">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download
                          </Button>
                        </a>
                      )}
                    </div>

                    {activeClip.caption && (
                      <div style={{ marginTop: 20, borderTop: '1px solid #1a1a1a', paddingTop: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Caption</p>
                          <button
                            onClick={() => copyCaption(activeClip.caption, activeClip.id)}
                            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: copied === activeClip.id ? '#86efac' : 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'color 200ms' }}
                          >
                            {copied === activeClip.id ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, background: '#111', padding: '14px 16px', borderRadius: 10, border: '1px solid #1e1e1e', fontFamily: "'DM Mono', monospace" }}>
                          {activeClip.caption}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
