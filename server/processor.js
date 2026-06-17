const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const { updateJob, addClip } = require('./store')

const CLIPS_DIR = process.env.CLIPS_DIR || path.join(__dirname, 'clips')
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads')

;[CLIPS_DIR, UPLOADS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }))

// Write cookies file from env var if present
const COOKIES_PATH = path.join(__dirname, 'yt-cookies.txt')
if (process.env.YOUTUBE_COOKIES) {
  fs.writeFileSync(COOKIES_PATH, process.env.YOUTUBE_COOKIES)
  console.log('✓ YouTube cookies written from env')
}

const getDuration = (filePath) => new Promise((resolve, reject) => {
  ffmpeg.ffprobe(filePath, (err, meta) => {
    if (err) reject(err)
    else resolve(meta.format.duration)
  })
})

const cutClip = (inputPath, outputPath, start, duration) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .setStartTime(start)
    .setDuration(duration)
    .outputOptions(['-c:v libx264', '-c:a aac', '-preset fast', '-crf 23', '-movflags +faststart'])
    .output(outputPath)
    .on('end', resolve)
    .on('error', reject)
    .run()
})

const getSegments = (duration, options = {}) => {
  const clipDuration = Math.max(10, options.clipDuration || 60)
  const maxClips = Math.min(50, options.maxClips || 8)
  const startAt = Math.max(0, options.startAt || 0)
  const endAt = Math.min(duration, options.endAt || duration)

  const segments = []
  let start = startAt
  while (start < endAt - 5) {
    const end = Math.min(start + clipDuration, endAt)
    if (end - start >= 5) segments.push({ start, end, duration: end - start })
    start += clipDuration
    if (segments.length >= maxClips) break
  }
  return segments
}

const downloadYoutube = (url, destDir) => new Promise((resolve, reject) => {
  const outputTemplate = path.join(destDir, '%(id)s.%(ext)s')
  const ytdlp = process.env.YTDLP_PATH || 'yt-dlp'

  const args = [
    url,
    '-o', outputTemplate,
    '--format', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--print', 'after_move:filepath',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=android,web;formats=missing_pot',
    '-v'
  ]

  // Use cookies if available
  if (fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH)
    console.log('✓ Using YouTube cookies')
  } else {
    console.warn('⚠ No cookies found — download may fail on server IPs')
  }

  let output = ''
  let errOutput = ''

  const child = require('child_process').spawn(ytdlp, args)
  child.stdout.on('data', d => { output += d.toString() })
  child.stderr.on('data', d => { errOutput += d.toString() })
  child.on('close', code => {
    if (code !== 0) {
      console.error('--- yt-dlp full output (for diagnosis) ---')
      console.error(errOutput)
      console.error('--- end yt-dlp output ---')
      return reject(new Error(`yt-dlp failed: ${errOutput.slice(-700)}`))
    }
    const filePath = output.trim().split('\n').pop()
    if (!filePath || !fs.existsSync(filePath)) {
      const files = fs.readdirSync(destDir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => ({ f, t: fs.statSync(path.join(destDir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
      if (files.length) return resolve(path.join(destDir, files[0].f))
      return reject(new Error('Downloaded file not found'))
    }
    resolve(filePath)
  })
})

const processVideo = async (jobId, filePath, originalFilename, options = {}) => {
  try {
    updateJob(jobId, { status: 'extracting' })
    const duration = await getDuration(filePath)
    updateJob(jobId, { duration_seconds: duration, status: 'transcribing' })
    await new Promise(r => setTimeout(r, 800))
    updateJob(jobId, { status: 'segmenting' })
    const segments = getSegments(duration, options)
    updateJob(jobId, { status: 'rendering' })
    await Promise.all(segments.map(async (seg, i) => {
      const clipFilename = `${jobId}_clip_${i + 1}.mp4`
      const clipPath = path.join(CLIPS_DIR, clipFilename)
      await cutClip(filePath, clipPath, seg.start, seg.duration)
      addClip(jobId, {
        filename: clipFilename,
        file_path: clipPath,
        url: `/clips/${clipFilename}`,
        start_time: seg.start,
        end_time: seg.end,
        duration_seconds: seg.duration,
        caption: `Clip ${i + 1} — ${Math.round(seg.duration)}s`
      })
    }))
    updateJob(jobId, { status: 'completed' })
    console.log(`✓ Job ${jobId} done — ${segments.length} clips`)
  } catch (err) {
    console.error(`✗ Job ${jobId} failed:`, err.message)
    updateJob(jobId, { status: 'failed', error_message: err.message })
  }
}

const processYoutube = async (jobId, youtubeUrl, options = {}) => {
  try {
    updateJob(jobId, { status: 'downloading' })
    console.log(`⬇ Downloading ${youtubeUrl}`)
    const filePath = await downloadYoutube(youtubeUrl, UPLOADS_DIR)
    console.log(`✓ Downloaded to ${filePath}`)
    updateJob(jobId, { file_path: filePath, stored_filename: path.basename(filePath) })
    await processVideo(jobId, filePath, path.basename(filePath), options)
  } catch (err) {
    console.error(`✗ YouTube job ${jobId} failed:`, err.message)
    updateJob(jobId, { status: 'failed', error_message: err.message })
  }
}

module.exports = { processVideo, processYoutube, UPLOADS_DIR, CLIPS_DIR }
