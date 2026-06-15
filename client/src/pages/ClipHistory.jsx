import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Button from '../components/ui/Button'
import api from '../lib/api'

const STATUS_COLOR = {
  completed: '#86efac',
  failed: '#f87171',
  pending: 'rgba(255,255,255,0.3)',
  processing: '#fbbf24',
  extracting: '#fbbf24',
  transcribing: '#fbbf24',
  segmenting: '#fbbf24',
  rendering: '#fbbf24',
  downloading: '#fbbf24'
}

const STATUS_LABEL = {
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  extracting: 'Extracting',
  transcribing: 'Transcribing',
  segmenting: 'Segmenting',
  rendering: 'Rendering',
  downloading: 'Downloading'
}

export default function ClipHistory() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = () => {
    api.get('/jobs').then(res => {
      setJobs(res.data.jobs || [])
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchJobs()
    // Auto-refresh while any jobs are in progress
    const interval = setInterval(() => {
      api.get('/jobs').then(res => {
        const j = res.data.jobs || []
        setJobs(j)
        const anyActive = j.some(job => !['completed', 'failed'].includes(job.status))
        if (!anyActive) clearInterval(interval)
      }).catch(() => {})
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const jobLabel = (job) => {
    if (job.youtube_url) return `YT · ${job.youtube_url.slice(32, 60) || job.youtube_url}`
    return job.original_filename || 'Untitled'
  }

  return (
    <AppLayout>
      <div style={{ padding: 'clamp(28px, 4vw, 48px)', maxWidth: 900 }}>
        <div style={{ marginBottom: 32, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>History</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>All processed videos this session</p>
          </div>
          <Link to="/"><Button size="md">+ New video</Button></Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(134,239,172,0.2)', borderTopColor: '#86efac', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 16, padding: '64px 40px', textAlign: 'center', animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 80ms both' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🎬</div>
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, letterSpacing: '-0.01em' }}>No videos yet</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Upload a video or paste a YouTube link to get started
            </p>
            <Link to="/"><Button size="md">Process a video</Button></Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 80ms both' }}>
            {jobs.map(job => (
              <Link
                key={job.id}
                to={job.status === 'completed' ? `/clips/${job.id}` : '#'}
                style={{
                  display: 'block', background: '#0d0d0d', border: '1px solid #1a1a1a',
                  borderRadius: 14, padding: '18px 22px', textDecoration: 'none',
                  transition: 'all 200ms', cursor: job.status === 'completed' ? 'pointer' : 'default'
                }}
                onMouseEnter={e => job.status === 'completed' && (e.currentTarget.style.background = '#111', e.currentTarget.style.borderColor = '#252525')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0d0d0d', e.currentTarget.style.borderColor = '#1a1a1a')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{job.youtube_url ? '▶' : '🎬'}</span>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#fff', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {jobLabel(job)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: STATUS_COLOR[job.status] || 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                        {!['completed', 'failed'].includes(job.status) && (
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', marginRight: 5, animation: 'pulse-green 1.2s infinite' }} />
                        )}
                        {STATUS_LABEL[job.status] || job.status}
                      </span>
                      {job.clips_count > 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {job.clips_count} clip{job.clips_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {job.duration_seconds && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {Math.round(job.duration_seconds)}s
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                        {new Date(job.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {job.status === 'completed' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
