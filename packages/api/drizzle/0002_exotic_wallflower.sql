CREATE TYPE "public"."run_type" AS ENUM('test', 'suite', 'project', 'recording');--> statement-breakpoint
CREATE TYPE "public"."schedule_target_type" AS ENUM('test', 'suite', 'project', 'recording');--> statement-breakpoint
CREATE TYPE "public"."browser_result_status" AS ENUM('pending', 'running', 'passed', 'failed', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TABLE "test_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"suite_id" uuid NOT NULL,
	"recording_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"slug" varchar(255) NOT NULL,
	"recording_data" jsonb NOT NULL,
	"recording_url" varchar(2048),
	"action_count" integer DEFAULT 0,
	"browsers" jsonb DEFAULT '["chromium"]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{"headless":true,"video":false,"screenshot":"only-on-failure","timeout":30000,"retries":0,"slowMo":0}'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"last_run_id" uuid,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(50),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_browser_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"browser" varchar(50) NOT NULL,
	"status" "browser_result_status" DEFAULT 'pending' NOT NULL,
	"duration_ms" varchar(20),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"actions_total" varchar(10),
	"actions_executed" varchar(10),
	"actions_failed" varchar(10),
	"actions_skipped" varchar(10),
	"error_message" text,
	"error_stack" text,
	"error_action_id" varchar(50),
	"error_action_index" varchar(10),
	"video_path" varchar(500),
	"screenshot_path" varchar(500),
	"trace_path" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "recording_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "recording_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "recording_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "run_type" "run_type" DEFAULT 'recording';--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "test_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "suite_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "test_name" varchar(255);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "test_slug" varchar(255);--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "target_type" "schedule_target_type" DEFAULT 'recording';--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "test_id" uuid;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "suite_id" uuid;--> statement-breakpoint
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_suite_id_test_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."test_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_browser_results" ADD CONSTRAINT "run_browser_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_browser_results" ADD CONSTRAINT "run_browser_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_browser_results" ADD CONSTRAINT "run_browser_results_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_suites_project_id_idx" ON "test_suites" USING btree ("project_id","display_order") WHERE "test_suites"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "test_suites_user_id_idx" ON "test_suites" USING btree ("user_id") WHERE "test_suites"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "test_suites_project_name_unique_idx" ON "test_suites" USING btree ("project_id",LOWER("name")) WHERE "test_suites"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tests_suite_id_idx" ON "tests" USING btree ("suite_id","display_order") WHERE "tests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tests_project_id_idx" ON "tests" USING btree ("project_id") WHERE "tests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tests_user_id_idx" ON "tests" USING btree ("user_id") WHERE "tests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tests_project_slug_unique_idx" ON "tests" USING btree ("project_id","slug") WHERE "tests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tests_project_name_idx" ON "tests" USING btree ("project_id","name") WHERE "tests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tests_last_run_status_idx" ON "tests" USING btree ("project_id","last_run_status") WHERE "tests"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "run_browser_results_run_id_idx" ON "run_browser_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_browser_results_test_id_idx" ON "run_browser_results" USING btree ("test_id","created_at");--> statement-breakpoint
CREATE INDEX "run_browser_results_user_id_idx" ON "run_browser_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "run_browser_results_status_idx" ON "run_browser_results" USING btree ("run_id","status") WHERE "run_browser_results"."status" = 'failed';--> statement-breakpoint
CREATE INDEX "run_browser_results_unique_idx" ON "run_browser_results" USING btree ("run_id","test_id","browser");--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_suite_id_test_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."test_suites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_suite_id_test_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."test_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_test_id_idx" ON "runs" USING btree ("test_id","created_at") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_suite_id_idx" ON "runs" USING btree ("suite_id","created_at") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_run_type_idx" ON "runs" USING btree ("project_id","run_type") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_test_id_idx" ON "schedules" USING btree ("test_id") WHERE "schedules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_suite_id_idx" ON "schedules" USING btree ("suite_id") WHERE "schedules"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_target_type_idx" ON "schedules" USING btree ("project_id","target_type") WHERE "schedules"."deleted_at" IS NULL;