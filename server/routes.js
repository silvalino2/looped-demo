const express = require('express')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { createJob, getJob, getAllJobs, getJobClips } = require('./store')
const { processYoutube, processCloudinary, UPLOADS_DIR } = require('./processor')

const router = express.Router()

const parseOptions = (body = {}) => ({
  clipDuration: body.clipDuration ? parseInt(body.clipDuration) : 60,
  maxClips: body.maxClips ? parseInt(body.maxClips) : 8,
  startAt: body.startAt ? parseInt(body.startAt) : 0,
  endAt: body.endAt ? parseInt(body.endAt) : undefined
})

// POST /api/jobs/cloudinary — accepts Cloudinary URL after direct browser upload
router.post('/cloudinary', express.json(), async (req, res) => {
  const { url, originalFilename } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  const options = parseOptions(req.body)

  try {
    const job = createJob({
      source: 'upload',
      original_filename: originalFilename || 'video.mp4',
      file_path: null,
      cloudinary_url: url
    })
    processCloudinary(job.id, url, originalFilename || 'video.mp4', options).catch(console.error)
    res.status(202).json({ jobId: job.id, message: 'Processing started' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create job' })
  }
})

// POST /api/jobs/youtube
router.post('/youtube', express.json(), async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'No URL provided' })

  const ytPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/
  if (!ytPattern.test(url)) return res.status(400).json({ error: 'Invalid YouTube URL' })

  const options = parseOptions(req.body)

  try {
    const job = createJob({
      source: 'youtube',
      original_filename: url,
      youtube_url: url,
      file_path: null
    })
    processYoutube(job.id, url, options).catch(console.error)
    res.status(202).json({ jobId: job.id, message: 'Download & processing started' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create job' })
  }
})

// POST /api/cloudinary-sign — generate signature for direct browser upload
router.post('/cloudinary-sign', express.json(), (req, res) => {
  const cloudinary = require('cloudinary').v2
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'looped-uploads'
  const paramsToSign = { timestamp, folder }
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)

  res.json({
    signature,
    timestamp,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY
  })
})

// GET /api/jobs
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
