const express = require('express')
const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { createJob, getJob, getAllJobs, getJobClips } = require('./store')
const { processVideo, processYoutube, UPLOADS_DIR } = require('./processor')

const router = express.Router()

// Parse clip options from request (works for both multipart body fields and JSON)
const parseOptions = (body = {}) => ({
  clipDuration: body.clipDuration ? parseInt(body.clipDuration) : 60,
  maxClips: body.maxClips ? parseInt(body.maxClips) : 8,
  startAt: body.startAt ? parseInt(body.startAt) : 0,
  endAt: body.endAt ? parseInt(body.endAt) : undefined
})

// Multer — no file size limit (unlimited)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mkv', 'video/x-matroska']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only video files are allowed'))
  }
})

// POST /api/jobs/upload — file upload
router.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    const options = parseOptions(req.body)
    const job = createJob({
      source: 'upload',
      original_filename: req.file.originalname,
      stored_filename: req.file.filename,
      file_path: req.file.path,
      options
    })
    processVideo(job.id, req.file.path, req.file.originalname, options).catch(console.error)
    res.status(202).json({ jobId: job.id, message: 'Processing started' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create job' })
  }
})

// POST /api/jobs/youtube — YouTube URL
router.post('/youtube', express.json(), async (req, res) => {
  const { url, clipDuration, maxClips, startAt, endAt } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  const ytPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' })

  const options = parseOptions(req.body)

  try {
    const job = createJob({
      source: 'youtube',
      original_filename: url,
      youtube_url: url,
      file_path: null,
      options
    })
    processYoutube(job.id, url, options).catch(console.error)
    res.status(202).json({ jobId: job.id, message: 'Download & processing started' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create job' })
  }
})

// GET /api/jobs — all jobs
router.get('/', (req, res) => {
  const jobs = getAllJobs().map(j => ({
    ...j,
    clips_count: getJobClips(j.id).length
  }))
  res.json({ jobs })
})

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({ job })
})

// GET /api/jobs/:id/status
router.get('/:id/status', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'Not found' })
  res.json({ status: job.status, error_message: job.error_message })
})

// GET /api/jobs/:id/clips
router.get('/:id/clips', (req, res) => {
  const job = getJob(req.params.id)
  if (!job) return res.status(404).json({ error: 'Not found' })
  res.json({ clips: getJobClips(req.params.id) })
})

module.exports = router
