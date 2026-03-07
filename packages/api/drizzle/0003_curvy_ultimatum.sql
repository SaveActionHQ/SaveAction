ALTER TABLE "runs" ADD COLUMN "assertions_total" varchar(10);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "assertions_passed" varchar(10);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "assertions_failed" varchar(10);--> statement-breakpoint
ALTER TABLE "run_actions" ADD COLUMN "assertion_passed" varchar(10);--> statement-breakpoint
ALTER TABLE "run_actions" ADD COLUMN "assertion_expected" text;--> statement-breakpoint
ALTER TABLE "run_actions" ADD COLUMN "assertion_actual" text;--> statement-breakpoint
ALTER TABLE "run_actions" ADD COLUMN "assertion_check_type" varchar(50);--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "variables" jsonb DEFAULT '{}'::jsonb;