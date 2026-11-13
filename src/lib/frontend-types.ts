export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type ProcessingJob = {
  id: string;
  videoId: string;
  status: ProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
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
  storageKey: string;
  createdAt: string;
};

export type ClipsResponse = {
  videoId: string;
  count: number;
  clips: GeneratedClip[];
};
