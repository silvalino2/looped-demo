const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const { updateJob, addClip } = require('./store')

const CLIPS_DIR = process.env.CLIPS_DIR || path.join(__dirname, 'clips')
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads')

;[CLIPS_DIR, UPLOADS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }))

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

// options: { clipDuration: seconds (default 60), maxClips: number (default 8), startAt: seconds, endAt: seconds }
const getSegments = (duration, options = {}) => {
  const clipDuration = Math.max(10, options.clipDuration || 60)
  const maxClips = Math.min(50, options.maxClips || 8)
  const startAt = Math.max(0, options.startAt || 0)
  const endAt = Math.min(duration, options.endAt || duration)
  const effectiveDuration = endAt - startAt

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

// Download YouTube video using yt-dlp
const downloadYoutube = (url, destDir) => new Promise((resolve, reject) => {
  const outputTemplate = path.join(destDir, '%(id)s.%(ext)s')

  // Check if yt-dlp is available
  const ytdlp = process.env.YTDLP_PATH || 'yt-dlp'

  const args = [
    url,
    '-o', outputTemplate,
    '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--print', 'after_move:filepath',
    '--no-warnings'
  ]

  let output = ''
  let errOutput = ''

  const child = require('child_process').spawn(ytdlp, args)
  child.stdout.on('data', d => { output += d.toString() })
  child.stderr.on('data', d => { errOutput += d.toString() })
  child.on('close', code => {
    if (code !== 0) return reject(new Error(`yt-dlp failed: ${errOutput.slice(-300)}`))
    const filePath = output.trim().split('\n').pop()
    if (!filePath || !fs.existsSync(filePath)) {
      // fallback: find newest mp4 in dest
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
