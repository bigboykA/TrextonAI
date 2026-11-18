CREATE TYPE "public"."outbox_delivery_status" AS ENUM('pending', 'claimed', 'published');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_type" AS ENUM('video_processing_requested');--> statement-breakpoint
CREATE TABLE "processing_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "outbox_event_type" DEFAULT 'video_processing_requested' NOT NULL,
	"processing_job_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"claimed_by" varchar(255),
	"claimed_at" timestamp,
	"claim_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN "processing_job_id" uuid;--> statement-breakpoint
UPDATE "upload_sessions" AS "session"
SET "processing_job_id" = (
	SELECT "job"."id"
	FROM "processing_jobs" AS "job"
	WHERE "job"."video_id" = "session"."video_id"
	ORDER BY "job"."created_at" ASC
	LIMIT 1
)
WHERE "session"."status" = 'completed'
	AND "session"."processing_job_id" IS NULL;--> statement-breakpoint
ALTER TABLE "processing_outbox" ADD CONSTRAINT "processing_outbox_processing_job_id_processing_jobs_id_fk" FOREIGN KEY ("processing_job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "processing_outbox_job_uidx" ON "processing_outbox" USING btree ("processing_job_id");--> statement-breakpoint
INSERT INTO "processing_outbox" (
	"event_type",
	"processing_job_id",
	"payload"
)
SELECT
	'video_processing_requested',
	"job"."id",
	jsonb_build_object(
		'videoId', "job"."video_id",
		'jobId', "job"."id"
	)
FROM "processing_jobs" AS "job"
WHERE "job"."status" = 'pending'
ON CONFLICT ("processing_job_id") DO NOTHING;--> statement-breakpoint
CREATE INDEX "processing_outbox_pending_idx" ON "processing_outbox" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "processing_outbox_claim_expiry_idx" ON "processing_outbox" USING btree ("status","claim_expires_at");--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_processing_job_id_processing_jobs_id_fk" FOREIGN KEY ("processing_job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_processing_job_id_uidx" ON "upload_sessions" USING btree ("processing_job_id") WHERE "upload_sessions"."processing_job_id" is not null;