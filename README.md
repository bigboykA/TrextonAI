# Trexton AI

**Turning hours of gaming content into moments worth sharing.**

Trexton AI is an AI-powered video clipping platform built for gamers and content creators. It aims to automatically identify engaging moments from gaming streams and transform them into short-form videos ready for TikTok, YouTube Shorts, and Instagram Reels.

Instead of spending hours reviewing recordings, creators can focus on streaming while Trexton AI helps discover the moments their audiences would want to watch.

> **Project Status:** 🚧 Under active development — backend infrastructure and job processing.

## The Problem

Gaming streamers can spend hours producing content, but only a small fraction of a livestream may be suitable for short-form platforms.

Finding those moments manually means reviewing recordings, identifying highlights, trimming footage, and preparing clips for publishing.

Trexton AI aims to automate much of this workflow.

## What We're Building

The initial version of Trexton AI focuses on analyzing completed gaming recordings and generating high-quality highlight clips.

### Planned Features

- **AI Highlight Detection:** Identify entertaining gameplay, funny interactions, clutch moments, and streamer reactions.
- **Context-Aware Clipping:** Preserve the setup, main event, and reaction so clips tell a complete story.
- **Highlight Ranking:** Recommend the strongest moments from a recording.
- **Automatic Clip Generation:** Extract video segments and prepare short-form content.
- **Creator Dashboard:** Preview, review, and manage generated highlights.
- **Twitch Integration:** Connect Twitch accounts and discover completed streams, subject to supported media access.
- **Creator Feedback:** Learn from accepted and rejected highlights to improve future recommendations.

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js | Frontend and backend API |
| TypeScript | Application and worker development |
| Tailwind CSS | User interface styling |
| PostgreSQL | Persistent application data |
| Drizzle ORM | Type-safe database queries and schema management |
| Redis | Background job coordination |
| BullMQ | Asynchronous job queue |
| Docker | Local infrastructure and container management |
| FFmpeg  | Video processing and clip extraction |
| Object Storage  | Video recordings and generated clips |
| AI Models (planned) | Audio transcription and multimodal highlight analysis |

## System Architecture

Trexton AI uses an asynchronous job-processing architecture to separate user requests from computationally expensive video analysis.

```text
             Creator
                |
                v
         Next.js Application
                |
                v
           Backend API
             /     \
            v       v
       PostgreSQL   BullMQ
                        |
                        v
                      Redis
                        |
                        v
                Background Worker
                        |
                        v
                 AI Video Analysis
                    (Planned)
                        |
                        v
                 Clip Generation
                    (Planned)
                        |
                        v
                  Creator Dashboard
```

The API submits processing jobs to BullMQ, which uses Redis to coordinate execution. A separate worker picks up jobs and performs processing independently of incoming HTTP requests.

PostgreSQL stores application records, including users, videos, and processing job metadata.

## Getting Started

### Prerequisites

- Node.js 20.9+
- npm
- Docker Desktop

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd trexton-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file:

```env
DATABASE_URL=postgresql://trexton:trexton_dev@localhost:5432/trexton
REDIS_URL=redis://localhost:6379
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=trexton-media
# Required only when the database contains multiple users:
# DEV_UPLOAD_USER_ID=00000000-0000-4000-8000-000000000000
```

These values are intended for local development only.

### 4. Start infrastructure services

```bash
docker compose up -d
```

This starts the PostgreSQL and Redis containers.

### 5. Run database migrations

```bash
npm run db:migrate
```

### 6. Start the application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 7. Start the background worker

In a separate terminal:

```bash
npm run worker
```

The worker streams completed recordings from private R2 storage
into an isolated operating-system temporary directory. Generated
clips are uploaded to deterministic private keys under
`clips/{videoId}/{jobId}/`. Temporary workspaces are removed in a
`finally` block; workspaces older than 24 hours are also removed when
the worker starts because abrupt process termination cannot run
JavaScript cleanup.

Legacy video rows remain supported. A storage key of
`local:filename.mp4` explicitly resolves from `local-videos/`;
pre-existing bare `filename.mp4` values are treated the same way.
New uploads always use R2 object keys.

### 8. Submit a test processing job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"videoId":"test-video-123"}'
```

Expected response:

```json
{
  "message": "Video processing job created",
  "jobId": "1",
  "videoId": "test-video-123"
}
```

The endpoint accepts only registered videos. R2-backed recordings
must have a completed upload session. Repeated requests return the
existing pending/processing job rather than enqueueing duplicates.

## Development Roadmap

- [x] Initialize Next.js and TypeScript project
- [x] Configure PostgreSQL and Redis with Docker
- [x] Set up Drizzle ORM
- [x] Define initial database schema
- [x] Implement BullMQ job submission endpoint
- [x] Verify background worker processing end to end
- [x] Persist processing job status in PostgreSQL
- [x] Implement video uploads and object storage
- [x] Build audio transcription pipeline
- [x] Implement AI highlight detection and ranking
- [x] Generate clips using FFmpeg
- [x] Build highlight preview and management dashboard
- [ ] Integrate Twitch authentication and supported VOD workflows
- [ ] Add creator feedback and personalization

## Long-Term Vision

Trexton AI aims to go beyond basic highlight detection.

The goal is to build a content assistant that understands gaming context, streamer personalities, and what makes individual moments entertaining.

Future capabilities may include real-time highlight detection, automated short-form editing, publishing integrations, and personalized recommendations based on creator preferences and content performance.

## License

License information has not yet been specified.
