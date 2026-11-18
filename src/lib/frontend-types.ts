export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type SubmissionStatus =
  | "awaiting_publication"
  | "queued"
  | ProcessingStatus;

export type ProcessingJob = {
  id: string;
  videoId: string;
  status: ProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  publicationStatus?: "pending" | "claimed" | "published" | null;
  submissionStatus?: SubmissionStatus;
};

export type RecordingSummary = {
  id: string;
  title: string | null;
  duration: string | null;
  sourceSizeBytes: number | null;
  createdAt: string;
  clipCount: number;
  latestJob: ProcessingJob | null;
};

export type UploadActivity = {
  id: string;
  videoId: string;
  fileName: string;
  fileSize: number;
  status:
    | "initiated"
    | "uploading"
    | "completing"
    | "completed"
    | "failed"
    | "aborted";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type JobActivity = ProcessingJob & {
  videoTitle: string | null;
};

export type GeneratedClip = {
  id: string;
  videoId: string;
  jobId: string;
  rank: number;
  start: number;
  end: number;
  score: number;
  reason: string;
  transcriptText: string | null;
  createdAt: string;
};

export type ClipsResponse = {
  videoId: string;
  count: number;
  clips: GeneratedClip[];
};
