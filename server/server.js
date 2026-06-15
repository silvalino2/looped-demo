require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { CLIPS_DIR, UPLOADS_DIR } = require('./processor')

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

// Serve generated clips & uploads
app.use('/clips', express.static(CLIPS_DIR))
app.use('/uploads', express.static(UPLOADS_DIR))

// API
app.use('/api/jobs', require('./routes'))

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// Serve React build in production
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
