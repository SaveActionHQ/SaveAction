CREATE TYPE "public"."browser_type" AS ENUM('chromium', 'firefox', 'webkit');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'passed', 'failed', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('success', 'failed', 'skipped', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('active', 'paused', 'disabled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('run.started', 'run.completed', 'run.passed', 'run.failed', 'run.cancelled', 'recording.created', 'recording.updated', 'recording.deleted', 'schedule.triggered', 'schedule.failed', 'schedule.paused', 'api_token.created', 'api_token.expired');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('active', 'paused', 'disabled', 'suspended');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255),
	"email_verified_at" timestamp with time zone,
	"failed_login_attempts" varchar(10) DEFAULT '0' NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(45),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"token_prefix" varchar(20) NOT NULL,
	"token_suffix" varchar(8) NOT NULL,
	"scopes" text DEFAULT '[]' NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_used_ip" varchar(45),
	"use_count" varchar(20) DEFAULT '0' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"description" text,
	"original_id" varchar(50),
	"tags" text DEFAULT '[]' NOT NULL,
	"data" jsonb NOT NULL,
	"action_count" varchar(10) DEFAULT '0' NOT NULL,
	"estimated_duration_ms" varchar(20),
	"schema_version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"data_size_bytes" varchar(20),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recording_id" uuid,
	"recording_name" varchar(255) NOT NULL,
	"recording_url" varchar(2048) NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"job_id" varchar(100),
	"queue_name" varchar(50) DEFAULT 'test-runs',
	"browser" "browser_type" DEFAULT 'chromium' NOT NULL,
	"headless" boolean DEFAULT true NOT NULL,
	"video_enabled" boolean DEFAULT false NOT NULL,
	"screenshot_enabled" boolean DEFAULT false NOT NULL,
	"timeout" varchar(20) DEFAULT '30000' NOT NULL,
	"timing_enabled" boolean DEFAULT true NOT NULL,
	"timing_mode" varchar(20) DEFAULT 'realistic',
	"speed_multiplier" varchar(10) DEFAULT '1.0',
	"actions_total" varchar(10),
	"actions_executed" varchar(10),
	"actions_failed" varchar(10),
	"actions_skipped" varchar(10),
	"duration_ms" varchar(20),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"video_path" varchar(500),
	"screenshot_paths" text,
	"error_message" text,
	"error_stack" text,
	"error_action_id" varchar(50),
	"triggered_by" varchar(50) DEFAULT 'manual' NOT NULL,
	"schedule_id" uuid,
	"parent_run_id" uuid,
	"ci_metadata" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"action_id" varchar(50) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_index" varchar(10) NOT NULL,
	"status" "action_status" NOT NULL,
	"duration_ms" varchar(20),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"selector_used" varchar(50),
	"selector_value" text,
	"retry_count" varchar(10) DEFAULT '0',
	"retried_selectors" text,
	"error_message" text,
	"error_stack" text,
	"screenshot_path" varchar(500),
	"screenshot_before" varchar(500),
	"screenshot_after" varchar(500),
	"element_found" varchar(10) DEFAULT 'true',
	"element_visible" varchar(10),
	"element_tag_name" varchar(50),
	"page_url" varchar(2048),
	"page_title" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cron_expression" varchar(100) NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"status" "schedule_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"bullmq_job_key" varchar(255),
	"bullmq_job_pattern" varchar(255),
	"run_config" jsonb,
	"max_concurrent" varchar(10) DEFAULT '1',
	"max_daily_runs" varchar(10),
	"runs_today" varchar(10) DEFAULT '0',
	"runs_this_month" varchar(10) DEFAULT '0',
	"last_run_id" uuid,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(50),
	"next_run_at" timestamp with time zone,
	"total_runs" varchar(20) DEFAULT '0',
	"successful_runs" varchar(20) DEFAULT '0',
	"failed_runs" varchar(20) DEFAULT '0',
	"notify_on_failure" boolean DEFAULT true,
	"notify_on_success" boolean DEFAULT false,
	"notification_emails" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_id" uuid,
	"payload" jsonb,
	"success" boolean NOT NULL,
	"attempt_number" varchar(10) DEFAULT '1' NOT NULL,
	"request_url" varchar(2048) NOT NULL,
	"request_headers" jsonb,
	"response_code" varchar(10),
	"response_headers" jsonb,
	"response_body" text,
	"response_time_ms" varchar(10),
	"error_message" text,
	"error_code" varchar(50),
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"will_retry_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"url" varchar(2048) NOT NULL,
	"secret" varchar(255) NOT NULL,
	"status" "webhook_status" DEFAULT 'active' NOT NULL,
	"events" jsonb,
	"recording_ids" jsonb,
	"filter_tags" jsonb,
	"custom_headers" jsonb,
	"verify_ssl" boolean DEFAULT true,
	"max_retries" varchar(10) DEFAULT '3',
	"retry_delay_ms" varchar(10) DEFAULT '1000',
	"timeout_ms" varchar(10) DEFAULT '10000',
	"consecutive_failures" varchar(10) DEFAULT '0',
	"suspend_after_failures" varchar(10) DEFAULT '10',
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"total_deliveries" varchar(20) DEFAULT '0',
	"successful_deliveries" varchar(20) DEFAULT '0',
	"failed_deliveries" varchar(20) DEFAULT '0',
	"last_delivery_at" timestamp with time zone,
	"last_delivery_status" varchar(20),
	"last_response_code" varchar(10),
	"last_error_message" text,
	"rate_limit_per_minute" varchar(10) DEFAULT '60',
	"deliveries_this_minute" varchar(10) DEFAULT '0',
	"minute_reset_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_actions" ADD CONSTRAINT "run_actions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique_idx" ON "users" USING btree (LOWER("email"));--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_locked_until_idx" ON "users" USING btree ("locked_until") WHERE "users"."locked_until" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_unique_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_active_idx" ON "api_tokens" USING btree ("user_id","expires_at") WHERE "api_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "api_tokens_expires_at_idx" ON "api_tokens" USING btree ("expires_at") WHERE "api_tokens"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "recordings_user_id_idx" ON "recordings" USING btree ("user_id") WHERE "recordings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "recordings_name_idx" ON "recordings" USING btree ("user_id","name") WHERE "recordings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "recordings_url_idx" ON "recordings" USING btree ("user_id","url") WHERE "recordings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "recordings_tags_gin_idx" ON "recordings" USING gin (("tags"::jsonb));--> statement-breakpoint
CREATE INDEX "recordings_data_gin_idx" ON "recordings" USING gin ("data");--> statement-breakpoint
CREATE INDEX "recordings_original_id_idx" ON "recordings" USING btree ("original_id") WHERE "recordings"."original_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "recordings_deleted_at_idx" ON "recordings" USING btree ("deleted_at") WHERE "recordings"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "recordings_updated_at_idx" ON "recordings" USING btree ("user_id","updated_at") WHERE "recordings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_user_id_idx" ON "runs" USING btree ("user_id","created_at") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_recording_id_idx" ON "runs" USING btree ("recording_id","created_at") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("user_id","status") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_job_id_idx" ON "runs" USING btree ("job_id") WHERE "runs"."job_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "runs_running_idx" ON "runs" USING btree ("status","started_at") WHERE "runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "runs_created_at_idx" ON "runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "runs_schedule_id_idx" ON "runs" USING btree ("schedule_id") WHERE "runs"."schedule_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "runs_parent_run_id_idx" ON "runs" USING btree ("parent_run_id","created_at") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_deleted_at_idx" ON "runs" USING btree ("deleted_at") WHERE "runs"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "run_actions_run_id_idx" ON "run_actions" USING btree ("run_id","action_index");--> statement-breakpoint
CREATE INDEX "run_actions_failed_idx" ON "run_actions" USING btree ("run_id","status") WHERE "run_actions"."status" = 'failed';--> statement-breakpoint
CREATE INDEX "run_actions_type_idx" ON "run_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "run_actions_duration_idx" ON "run_actions" USING btree ("duration_ms") WHERE "run_actions"."duration_ms" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "schedules_user_id_idx" ON "schedules" USING btree ("user_id") WHERE "schedules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_active_idx" ON "schedules" USING btree ("status","next_run_at") WHERE "schedules"."status" = 'active' AND "schedules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_recording_id_idx" ON "schedules" USING btree ("recording_id") WHERE "schedules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_bullmq_job_key_idx" ON "schedules" USING btree ("bullmq_job_key") WHERE "schedules"."bullmq_job_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "schedules_next_run_idx" ON "schedules" USING btree ("next_run_at") WHERE "schedules"."status" = 'active' AND "schedules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id","delivered_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_retry_idx" ON "webhook_deliveries" USING btree ("will_retry_at") WHERE "webhook_deliveries"."will_retry_at" IS NOT NULL AND "webhook_deliveries"."success" = false;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_type_idx" ON "webhook_deliveries" USING btree ("event_type","delivered_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_date_idx" ON "webhook_deliveries" USING btree ("delivered_at");--> statement-breakpoint
CREATE INDEX "webhooks_user_id_idx" ON "webhooks" USING btree ("user_id") WHERE "webhooks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "webhooks_active_idx" ON "webhooks" USING btree ("status") WHERE "webhooks"."status" = 'active' AND "webhooks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "webhooks_suspended_idx" ON "webhooks" USING btree ("suspended_at") WHERE "webhooks"."status" = 'suspended';--> statement-breakpoint
CREATE INDEX "webhooks_user_url_idx" ON "webhooks" USING btree ("user_id","url") WHERE "webhooks"."deleted_at" IS NULL;