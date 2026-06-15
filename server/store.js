// In-memory store — no DB, no auth, unlimited usage
const { v4: uuidv4 } = require('uuid')

const jobs = new Map()   // jobId -> job object
const clips = new Map()  // jobId -> clips[]

const createJob = (data) => {
  const id = uuidv4()
  const job = {
    id,
    source: data.source,           // 'upload' | 'youtube'
    original_filename: data.original_filename,
    stored_filename: data.stored_filename || null,
    file_path: data.file_path,
    youtube_url: data.youtube_url || null,
    duration_seconds: null,
    status: 'pending',
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  jobs.set(id, job)
  clips.set(id, [])
  return job
}

const updateJob = (id, patch) => {
  const job = jobs.get(id)
  if (!job) return null
  Object.assign(job, patch, { updated_at: new Date().toISOString() })
  return job
}

const getJob = (id) => jobs.get(id) || null
const getAllJobs = () => [...jobs.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
const getJobClips = (jobId) => clips.get(jobId) || []

const addClip = (jobId, clip) => {
  const list = clips.get(jobId) || []
  const c = { id: uuidv4(), job_id: jobId, created_at: new Date().toISOString(), ...clip }
  list.push(c)
  clips.set(jobId, list)
  return c
}

module.exports = { createJob, updateJob, getJob, getAllJobs, getJobClips, addClip }
