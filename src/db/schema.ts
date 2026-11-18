
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  bigint,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// PROCESSING STATUS
export const processingStatus = pgEnum("processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// MULTIPART UPLOAD SESSION STATUS
export const uploadSessionStatus = pgEnum("upload_session_status", [
  "initiated",
  "uploading",
  "completing",
  "completed",
  "failed",
  "aborted",
]);

export const outboxEventType = pgEnum("outbox_event_type", [
  "video_processing_requested",
]);

export const outboxDeliveryStatus = pgEnum(
  "outbox_delivery_status",
  ["pending", "claimed", "published"]
);

// USERS
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: varchar("name", { length: 255 }).notNull(),

  email: varchar("email", { length: 255 })
    .notNull()
    .unique(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

// VIDEOS
export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),

  title: varchar("title", { length: 255 }).notNull(),

  storageKey: text("storage_key").notNull(),

  status: processingStatus("status")
    .default("pending")
    .notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

// PROCESSING JOBS
export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id),

    status: processingStatus("status")
      .default("pending")
      .notNull(),

    errorMessage: text("error_message"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    completedAt: timestamp("completed_at"),
  },
  (table) => [
    uniqueIndex("processing_jobs_active_video_uidx")
      .on(table.videoId)
      .where(
        sql`${table.status} in ('pending', 'processing')`
      ),
  ]
);

// GENERATED CLIPS
export const generatedClips = pgTable(
  "generated_clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id),

    jobId: uuid("job_id")
      .notNull()
      .references(() => processingJobs.id),

    rank: integer("rank").notNull(),

    start: doublePrecision("start").notNull(),

    end: doublePrecision("end").notNull(),

    score: integer("score").notNull(),

    reason: text("reason").notNull(),

    transcriptText: text("transcript_text"),

    storageKey: text("storage_key").notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("generated_clips_job_rank_uidx").on(
      table.jobId,
      table.rank
    ),
  ]
);

// MULTIPART UPLOAD SESSIONS
// Durable browser→R2 multipart state. Videos remain the
// canonical registered recording after a successful upload.
export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Reserved for auth. Nullable until user ownership exists.
    userId: uuid("user_id").references(() => users.id),

    // Application video UUID used in the object key path.
    // Not inserted into videos until registration exists.
    videoId: uuid("video_id").notNull(),

    // Opaque secret required for recover/sign/complete/abort.
    resumeToken: uuid("resume_token").notNull(),

    // R2 multipart upload ID (remote identifier only).
    r2UploadId: text("r2_upload_id").notNull(),

    objectKey: text("object_key").notNull(),

    fileName: varchar("file_name", { length: 512 }).notNull(),

    fileSize: bigint("file_size", { mode: "number" }).notNull(),

    partSize: integer("part_size").notNull(),

    partCount: integer("part_count").notNull(),

    // Client-provided identity: name|size|lastModified.
    // Not cryptographic; documents same-file intent only.
    fileFingerprint: text("file_fingerprint").notNull(),

    status: uploadSessionStatus("status")
      .default("initiated")
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),

    completedAt: timestamp("completed_at"),

    processingJobId: uuid("processing_job_id").references(
      () => processingJobs.id
    ),
  },
  (table) => [
    uniqueIndex("upload_sessions_resume_token_uidx").on(
      table.resumeToken
    ),
    uniqueIndex("upload_sessions_video_id_uidx").on(
      table.videoId
    ),
    uniqueIndex("upload_sessions_processing_job_id_uidx")
      .on(table.processingJobId)
      .where(sql`${table.processingJobId} is not null`),
    index("upload_sessions_status_idx").on(table.status),
  ]
);

export type VideoProcessingRequestedPayload = {
  videoId: string;
  jobId: string;
};

export const processingOutbox = pgTable(
  "processing_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    eventType: outboxEventType("event_type")
      .default("video_processing_requested")
      .notNull(),

    processingJobId: uuid("processing_job_id")
      .notNull()
      .references(() => processingJobs.id),

    payload: jsonb("payload")
      .$type<VideoProcessingRequestedPayload>()
      .notNull(),

    status: outboxDeliveryStatus("status")
      .default("pending")
      .notNull(),

    attemptCount: integer("attempt_count")
      .default(0)
      .notNull(),

    nextAttemptAt: timestamp("next_attempt_at")
      .defaultNow()
      .notNull(),

    lastError: text("last_error"),

    claimedBy: varchar("claimed_by", {
      length: 255,
    }),

    claimedAt: timestamp("claimed_at"),

    claimExpiresAt: timestamp("claim_expires_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    publishedAt: timestamp("published_at"),
  },
  (table) => [
    uniqueIndex("processing_outbox_job_uidx").on(
      table.processingJobId
    ),
    index("processing_outbox_pending_idx").on(
      table.status,
      table.nextAttemptAt,
      table.createdAt
    ),
    index("processing_outbox_claim_expiry_idx").on(
      table.status,
      table.claimExpiresAt
    ),
  ]
);
