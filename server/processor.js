const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const fetch = require('node-fetch')
const FormData = require('form-data')
const OpenAI = require('openai')
const { updateJob, addClip } = require('./store')

const CLIPS_DIR = process.env.CLIPS_DIR || path.join(__dirname, 'clips')
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads')
const SUBS_DIR = path.join(__dirname, 'subs')

;[CLIPS_DIR, UPLOADS_DIR, SUBS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }))

// YouTube cookies
const COOKIES_PATH = path.join(__dirname, 'yt-cookies.txt')
if (process.env.YOUTUBE_COOKIES) {
  fs.writeFileSync(COOKIES_PATH, process.env.YOUTUBE_COOKIES)
  console.log('✓ YouTube cookies written from env')
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── FFMPEG HELPERS ───────────────────────────────────────────────────────────

const getDuration = (filePath) => new Promise((resolve, reject) => {
  ffmpeg.ffprobe(filePath, (err, meta) => {
    if (err) reject(err)
    else resolve(meta.format.duration)
  })
})

const getVideoTitle = (filePath) => new Promise((resolve) => {
  ffmpeg.ffprobe(filePath, (err, meta) => {
    if (err || !meta) return resolve('Video')
    const title = meta.format?.tags?.title || path.basename(filePath, path.extname(filePath))
    resolve(title)
  })
})

// Cut raw clip (no subtitles yet)
const cutClip = (inputPath, outputPath, start, duration) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .setStartTime(start)
    .setDuration(duration)
    .outputOptions([
      '-c:v libx264', '-c:a aac', '-preset fast', '-crf 23', '-movflags +faststart'
    ])
    .output(outputPath)
    .on('end', resolve)
    .on('error', reject)
    .run()
})

// Burn subtitles into clip using ASS subtitle file
const burnSubtitles = (inputPath, assPath, outputPath) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .outputOptions([
      `-vf ass=${assPath}`,
      '-c:v libx264', '-c:a aac', '-preset fast', '-crf 23', '-movflags +faststart'
    ])
    .output(outputPath)
    .on('end', resolve)
    .on('error', (err) => {
      console.warn('Subtitle burn failed, using clip without subtitles:', err.message)
      fs.copyFileSync(inputPath, outputPath)
      resolve()
    })
    .run()
})

// ─── WHISPER TRANSCRIPTION ────────────────────────────────────────────────────

const transcribeClip = async (clipPath) => {
  try {
    const audioPath = clipPath.replace('.mp4', '_audio.mp3')
    // Extract audio for Whisper
    await new Promise((resolve, reject) => {
      ffmpeg(clipPath)
        .outputOptions(['-vn', '-ar 16000', '-ac 1', '-b:a 64k'])
        .output(audioPath)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    })

    // Clean up audio file
    try { fs.unlinkSync(audioPath) } catch {}

    return transcription
  } catch (err) {
    console.warn('Transcription failed:', err.message)
    return null
  }
}

// ─── ASS SUBTITLE GENERATION ──────────────────────────────────────────────────

const formatAssTime = (seconds) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

const generateAssSubtitles = (words, assPath) => {
  if (!words || words.length === 0) return false

  // Group words into subtitle lines (max 5 words or 3 seconds per line)
  const lines = []
  let currentWords = []
  let lineStart = null

  for (const word of words) {
    const start = word.start ?? 0
    const end = word.end ?? start + 0.5

    if (currentWords.length === 0) lineStart = start

    currentWords.push({ text: word.word, end })

    const lineDuration = end - lineStart
    if (currentWords.length >= 5 || lineDuration >= 3) {
      lines.push({
        start: lineStart,
        end,
        text: currentWords.map(w => w.text).join(' ').trim()
      })
      currentWords = []
      lineStart = null
    }
  }

  if (currentWords.length > 0 && lineStart !== null) {
    lines.push({
      start: lineStart,
      end: currentWords[currentWords.length - 1].end,
      text: currentWords.map(w => w.text).join(' ').trim()
    })
  }

  if (lines.length === 0) return false

  // Write ASS file with clean styling (white text, black outline, bottom center)
  const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,60,60,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const events = lines.map(line =>
    `Dialogue: 0,${formatAssTime(line.start)},${formatAssTime(line.end)},Default,,0,0,0,,${line.text}`
  ).join('\n')

  fs.writeFileSync(assPath, assHeader + events)
  return true
}

// ─── OPENAI CAPTION + HASHTAGS ────────────────────────────────────────────────

const generateCaption = async (transcript, videoTitle, clipIndex, clipDuration) => {
  try {
    const transcriptText = transcript?.text || ''
    const prompt = `You are a social media expert creating content for short-form video platforms (TikTok, Instagram Reels, YouTube Shorts).

Video title: "${videoTitle}"
Clip ${clipIndex} transcript (${Math.round(clipDuration)}s): "${transcriptText}"

Generate a caption and hashtags for this clip. Return ONLY valid JSON, no markdown:
{
  "caption": "engaging caption under 150 chars that hooks viewers",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.8
    })

    const raw = response.choices[0].message.content.trim()
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return {
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || []
    }
  } catch (err) {
    console.warn('Caption generation failed:', err.message)
    return { caption: `Clip ${clipIndex} — ${Math.round(clipDuration)}s`, hashtags: [] }
  }
}

// ─── SEGMENTS ─────────────────────────────────────────────────────────────────

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

// ─── YOUTUBE DOWNLOAD ─────────────────────────────────────────────────────────

const downloadYoutube = (url, destDir) => new Promise((resolve, reject) => {
  const outputTemplate = path.join(destDir, '%(id)s.%(ext)s')
  const ytdlp = process.env.YTDLP_PATH || 'yt-dlp'

  const denoPath = process.env.DENO_PATH || 'deno'

  const args = [
    url,
    '-o', outputTemplate,
    '--format', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--print', 'after_move:filepath',
    '--no-warnings',
    '--js-runtimes', `deno:${denoPath}`,
    '--remote-components', 'ejs:github',
    '--extractor-args', 'youtube:player_client=android,web;formats=missing_pot',
    '-v'
  ]

  if (fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH)
    console.log('✓ Using YouTube cookies')
  } else {
    console.warn('⚠ No cookies — download may fail')
  }

  let output = ''
  let errOutput = ''

  const child = require('child_process').spawn(ytdlp, args)
  child.stdout.on('data', d => { output += d.toString() })
  child.stderr.on('data', d => { errOutput += d.toString() })
  child.on('close', code => {
    if (code !== 0) {
      console.error('--- yt-dlp full output ---')
      console.error(errOutput)
      console.error('--- end ---')
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

// ─── CLOUDINARY DOWNLOAD ──────────────────────────────────────────────────────

const downloadFromCloudinary = async (cloudinaryUrl, destDir) => {
  const filename = `cloudinary_${Date.now()}.mp4`
  const destPath = path.join(destDir, filename)
  const response = await fetch(cloudinaryUrl)
  if (!response.ok) throw new Error(`Failed to fetch from Cloudinary: ${response.status}`)
  const buffer = await response.buffer()
  fs.writeFileSync(destPath, buffer)
  return destPath
}

// ─── MAIN PROCESS VIDEO ───────────────────────────────────────────────────────

const processVideo = async (jobId, filePath, originalFilename, options = {}) => {
  try {
    updateJob(jobId, { status: 'extracting' })
    const duration = await getDuration(filePath)
    const videoTitle = await getVideoTitle(filePath)
    updateJob(jobId, { duration_seconds: duration, video_title: videoTitle, status: 'segmenting' })

    const segments = getSegments(duration, options)
    updateJob(jobId, { status: 'rendering' })

    // Process clips sequentially (transcription + subtitle burn needs order)
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const clipFilename = `${jobId}_clip_${i + 1}.mp4`
      const rawClipPath = path.join(CLIPS_DIR, `${jobId}_raw_${i + 1}.mp4`)
      const finalClipPath = path.join(CLIPS_DIR, clipFilename)
      const assPath = path.join(SUBS_DIR, `${jobId}_clip_${i + 1}.ass`)

      console.log(`Processing clip ${i + 1}/${segments.length}...`)

      // 1. Cut raw clip
      await cutClip(filePath, rawClipPath, seg.start, seg.duration)

      // 2. Transcribe with Whisper
      updateJob(jobId, { status: 'transcribing' })
      const transcript = await transcribeClip(rawClipPath)

      // 3. Generate ASS subtitle file
      const words = transcript?.words || []
      const hasSubtitles = generateAssSubtitles(words, assPath)

      // 4. Burn subtitles into clip
      updateJob(jobId, { status: 'rendering' })
      if (hasSubtitles) {
        await burnSubtitles(rawClipPath, assPath, finalClipPath)
        try { fs.unlinkSync(assPath) } catch {}
      } else {
        fs.renameSync(rawClipPath, finalClipPath)
      }

      // Clean up raw clip if subtitle burn created a new file
      try { if (fs.existsSync(rawClipPath)) fs.unlinkSync(rawClipPath) } catch {}

      // 5. Generate caption + hashtags
      const { caption, hashtags } = await generateCaption(transcript, videoTitle, i + 1, seg.duration)

      addClip(jobId, {
        filename: clipFilename,
        file_path: finalClipPath,
        url: `/clips/${clipFilename}`,
        start_time: seg.start,
        end_time: seg.end,
        duration_seconds: seg.duration,
        caption,
        hashtags,
        transcript: transcript?.text || ''
      })
    }

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

const processCloudinary = async (jobId, cloudinaryUrl, originalFilename, options = {}) => {
  try {
    updateJob(jobId, { status: 'downloading' })
    console.log(`⬇ Downloading from Cloudinary: ${cloudinaryUrl}`)
    const filePath = await downloadFromCloudinary(cloudinaryUrl, UPLOADS_DIR)
    console.log(`✓ Downloaded to ${filePath}`)
    updateJob(jobId, { file_path: filePath, stored_filename: path.basename(filePath) })
    await processVideo(jobId, filePath, originalFilename, options)
  } catch (err) {
    console.error(`✗ Cloudinary job ${jobId} failed:`, err.message)
    updateJob(jobId, { status: 'failed', error_message: err.message })
  }
}

module.exports = { processVideo, processYoutube, processCloudinary, UPLOADS_DIR, CLIPS_DIR }
