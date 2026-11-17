DROP INDEX "upload_sessions_video_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "generated_clips_job_rank_uidx" ON "generated_clips" USING btree ("job_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_active_video_uidx" ON "processing_jobs" USING btree ("video_id") WHERE "processing_jobs"."status" in ('pending', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_video_id_uidx" ON "upload_sessions" USING btree ("video_id");