require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const { CLIPS_DIR, UPLOADS_DIR } = require('./processor')

// Install yt-dlp binary into the app directory at startup
const YTDLP_PATH = path.join(__dirname, 'yt-dlp')
const YTDLP_VERSION_FILE = path.join(__dirname, '.ytdlp-version')
const EXPECTED_VERSION = 'nightly-v1' // bump this string to force re-download on next deploy

const needsInstall = !fs.existsSync(YTDLP_PATH) ||
  !fs.existsSync(YTDLP_VERSION_FILE) ||
  fs.readFileSync(YTDLP_VERSION_FILE, 'utf8').trim() !== EXPECTED_VERSION

if (needsInstall) {
  console.log('⬇ Installing yt-dlp (nightly build)...')
  try {
    execSync(
      `curl -L https://github.com/yt-dlp/yt-dlp/releases/download/nightly/yt-dlp -o ${YTDLP_PATH} && chmod +x ${YTDLP_PATH}`,
      { stdio: 'inherit' }
    )
    fs.writeFileSync(YTDLP_VERSION_FILE, EXPECTED_VERSION)
    console.log('✓ yt-dlp (nightly) installed at', YTDLP_PATH)
  } catch (e) {
    console.error('✗ yt-dlp install failed:', e.message)
  }
} else {
  console.log('✓ yt-dlp already present (nightly)')
}

// Tell processor where the binary is
process.env.YTDLP_PATH = YTDLP_PATH

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CLIENT_URL || true)
    : 'http://localhost:3000',
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/clips', express.static(CLIPS_DIR))
app.use('/uploads', express.static(UPLOADS_DIR))

app.use('/api/jobs', require('./routes'))

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/dist')
  app.use(express.static(buildPath))
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')))
}

app.use((err, req, res, next) => {
  console.error(err.message)
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' })
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`\n🔁 Looped v2 (no-auth) running on port ${PORT}`)
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Clips: ${CLIPS_DIR}`)
  console.log(`   Uploads: ${UPLOADS_DIR}\n`)
})
