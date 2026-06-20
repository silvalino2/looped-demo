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
const EXPECTED_VERSION = 'nightly-v2' // bump this string to force re-download on next deploy

const needsInstall = !fs.existsSync(YTDLP_PATH) ||
  !fs.existsSync(YTDLP_VERSION_FILE) ||
  fs.readFileSync(YTDLP_VERSION_FILE, 'utf8').trim() !== EXPECTED_VERSION

if (needsInstall) {
  console.log('⬇ Installing yt-dlp (nightly build)...')
  try {
    execSync(
      `curl -L https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -o ${YTDLP_PATH} && chmod +x ${YTDLP_PATH}`,
      { stdio: 'inherit' }
    )
    // Sanity check: a valid yt-dlp binary is several MB; a 404 page is a few KB
    const stat = fs.statSync(YTDLP_PATH)
    if (stat.size < 1_000_000) {
      throw new Error(`Downloaded file is only ${stat.size} bytes — likely a 404 page, not the real binary`)
    }
    fs.writeFileSync(YTDLP_VERSION_FILE, EXPECTED_VERSION)
    console.log('✓ yt-dlp (nightly) installed at', YTDLP_PATH, `(${(stat.size / 1_000_000).toFixed(1)} MB)`)
  } catch (e) {
    console.error('✗ yt-dlp install failed:', e.message)
  }
} else {
  console.log('✓ yt-dlp already present (nightly)')
}

// Tell processor where the binary is
process.env.YTDLP_PATH = YTDLP_PATH

// Install Deno into the app directory at runtime (build-time installs don't
// persist to Railway's runtime container — learned this the hard way with yt-dlp)
const DENO_DIR = path.join(__dirname, 'deno-runtime')
const DENO_PATH = path.join(DENO_DIR, 'deno')
const DENO_VERSION_FILE = path.join(__dirname, '.deno-version')
const EXPECTED_DENO_VERSION = 'deno-v1'

const denoNeedsInstall = !fs.existsSync(DENO_PATH) ||
  !fs.existsSync(DENO_VERSION_FILE) ||
  fs.readFileSync(DENO_VERSION_FILE, 'utf8').trim() !== EXPECTED_DENO_VERSION

if (denoNeedsInstall) {
  console.log('⬇ Installing Deno (runtime, for yt-dlp JS challenges)...')
  try {
    fs.mkdirSync(DENO_DIR, { recursive: true })
    execSync(
      `curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o ${DENO_DIR}/deno.zip && cd ${DENO_DIR} && unzip -o deno.zip && chmod +x deno && rm deno.zip`,
      { stdio: 'inherit' }
    )
    const stat = fs.statSync(DENO_PATH)
    if (stat.size < 10_000_000) {
      throw new Error(`Downloaded Deno is only ${stat.size} bytes — install likely failed`)
    }
    fs.writeFileSync(DENO_VERSION_FILE, EXPECTED_DENO_VERSION)
    console.log('✓ Deno installed at', DENO_PATH, `(${(stat.size / 1_000_000).toFixed(1)} MB)`)
  } catch (e) {
    console.error('✗ Deno install failed:', e.message)
  }
} else {
  console.log('✓ Deno already present')
}

// Tell processor exactly where deno lives (explicit path, not relying on PATH)
process.env.DENO_PATH = DENO_PATH

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
