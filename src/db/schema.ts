
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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
export const processingJobs = pgTable("processing_jobs", {
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
});

// GENERATED CLIPS
export const generatedClips = pgTable("generated_clips", {
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
});

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
  },
  (table) => [
    uniqueIndex("upload_sessions_resume_token_uidx").on(
      table.resumeToken
    ),
    index("upload_sessions_video_id_idx").on(table.videoId),
    index("upload_sessions_status_idx").on(table.status),
  ]
);
