
import {pgTable,uuid,varchar,text,timestamp,pgEnum,integer,doublePrecision,} from "drizzle-orm/pg-core";

// PROCESSING STATUS
export const processingStatus = pgEnum("processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
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
