# looped v2 — no auth, no limits

Stripped-down rebuild. No login, no payments, no admin, no DB. Just drop a video or paste a YouTube link and get clips.

## What's gone
- Auth (no login, register, JWT)
- Admin dashboard
- Payments (Paystack)
- Landing page
- Settings page
- Subscription checks
- PostgreSQL (replaced with in-memory store)

## What's new
- YouTube URL input (paste link → auto-download → clip)
- No file size limit
- No upload count limits
- Zero configuration DB

## Requirements

- Node.js 18+
- ffmpeg installed and in PATH
- yt-dlp installed and in PATH (for YouTube support)

### Install ffmpeg
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

### Install yt-dlp
```bash
pip install yt-dlp
# or
brew install yt-dlp
# or download binary: https://github.com/yt-dlp/yt-dlp/releases
```

## Setup

```bash
# 1. Install dependencies
npm run install:all

# 2. Copy env
cp server/.env.example server/.env

# 3. Run dev (both server + client)
npm run dev
```

Server runs on `http://localhost:5000`
Client runs on `http://localhost:3000`

## Production deploy (e.g. Render)

```bash
# Build client
npm run build

# Set env vars on Render:
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-domain.com

# Start command:
npm start
```

Note: In production, serve from a single Render Web Service.
The server serves the built React from `/client/dist`.

## YouTube note

yt-dlp must be installed on the server. On Render, add to your build command:
```bash
pip install yt-dlp && npm run install:all && npm run build
```

## Clip storage note

Clips are stored on disk in `server/clips/`. On Render free tier, disk resets on redeploy.
For persistence, mount a volume and set `CLIPS_DIR` env var to the mount path.

## In-memory jobs note

All job state lives in memory. Server restart = history cleared. That's intentional for this version.
Swap `store.js` for a SQLite or PostgreSQL implementation when you need persistence.
