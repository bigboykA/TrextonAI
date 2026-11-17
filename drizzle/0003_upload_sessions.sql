CREATE TYPE "public"."upload_session_status" AS ENUM('initiated', 'uploading', 'completing', 'completed', 'failed', 'aborted');--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"video_id" uuid NOT NULL,
	"resume_token" uuid NOT NULL,
	"r2_upload_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(512) NOT NULL,
	"file_size" bigint NOT NULL,
	"part_size" integer NOT NULL,
	"part_count" integer NOT NULL,
	"file_fingerprint" text NOT NULL,
	"status" "upload_session_status" DEFAULT 'initiated' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_resume_token_uidx" ON "upload_sessions" USING btree ("resume_token");--> statement-breakpoint
CREATE INDEX "upload_sessions_video_id_idx" ON "upload_sessions" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");