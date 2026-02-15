CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7),
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_name_unique_idx" ON "projects" USING btree ("user_id",LOWER("name"));--> statement-breakpoint
CREATE INDEX "projects_user_default_idx" ON "projects" USING btree ("user_id","is_default") WHERE "projects"."is_default" = true AND "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "projects_deleted_at_idx" ON "projects" USING btree ("deleted_at") WHERE "projects"."deleted_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordings_project_id_idx" ON "recordings" USING btree ("project_id") WHERE "recordings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "recordings_project_user_idx" ON "recordings" USING btree ("project_id","user_id") WHERE "recordings"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_project_id_idx" ON "runs" USING btree ("project_id","created_at") WHERE "runs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "schedules_project_id_idx" ON "schedules" USING btree ("project_id") WHERE "schedules"."deleted_at" IS NULL;