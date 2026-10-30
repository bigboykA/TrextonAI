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
| FFmpeg (planned) | Video processing and clip extraction |
| Object Storage (planned) | Video recordings and generated clips |
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
```

These values are intended for local development only.

### 4. Start infrastructure services

```bash
docker compose up -d
```

This starts the PostgreSQL and Redis containers.

### 5. Run database migrations

```bash
npx drizzle-kit migrate
```

### 6. Start the application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 7. Start the background worker

In a separate terminal:

```bash
npx tsx src/workers/video.worker.ts
```

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

The current job processor simulates video analysis. Actual AI inference and video generation are not implemented yet.

## Development Roadmap

- [x] Initialize Next.js and TypeScript project
- [x] Configure PostgreSQL and Redis with Docker
- [x] Set up Drizzle ORM
- [x] Define initial database schema
- [x] Implement BullMQ job submission endpoint
- [ ] Verify background worker processing end to end
- [ ] Persist processing job status in PostgreSQL
- [ ] Implement video uploads and object storage
- [ ] Build audio transcription pipeline
- [ ] Implement AI highlight detection and ranking
- [ ] Generate clips using FFmpeg
- [ ] Build highlight preview and management dashboard
- [ ] Integrate Twitch authentication and supported VOD workflows
- [ ] Add creator feedback and personalization

## Long-Term Vision

Trexton AI aims to go beyond basic highlight detection.

The goal is to build a content assistant that understands gaming context, streamer personalities, and what makes individual moments entertaining.

Future capabilities may include real-time highlight detection, automated short-form editing, publishing integrations, and personalized recommendations based on creator preferences and content performance.

## License

License information has not yet been specified.
