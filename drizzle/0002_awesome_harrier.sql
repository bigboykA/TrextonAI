CREATE TABLE "generated_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"start" double precision NOT NULL,
	"end" double precision NOT NULL,
	"score" integer NOT NULL,
	"reason" text NOT NULL,
	"transcript_text" text,
	"storage_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_clips" ADD CONSTRAINT "generated_clips_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_clips" ADD CONSTRAINT "generated_clips_job_id_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE no action ON UPDATE no action;