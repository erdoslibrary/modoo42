CREATE TYPE "public"."campus_type" AS ENUM('GS', 'SEOUL');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('JOINED', 'LEFT', 'REMOVED', 'COMPLETED', 'INCOMPLETE');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('RECRUITING', 'CLOSED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('STUDY', 'PARTY', 'LIVE');--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "participant_status" DEFAULT 'JOINED' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leader_id" uuid NOT NULL,
	"type" "post_type" NOT NULL,
	"template_id" text,
	"template_data" jsonb,
	"title" text NOT NULL,
	"tags" text[] NOT NULL,
	"location_type" "location_type" NOT NULL,
	"place" text,
	"max_members" integer,
	"current_members" integer DEFAULT 1 NOT NULL,
	"cycle" text,
	"end_date" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"chat_url" text,
	"reference_url" text,
	"description" text,
	"status" "post_status" DEFAULT 'RECRUITING' NOT NULL,
	"proof_type" text,
	"proof_url" text,
	"postmortem_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intra_id" text NOT NULL,
	"campus" "campus_type" NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"leader_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_intra_id_unique" UNIQUE("intra_id")
);
--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participants_post_user_idx" ON "participants" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "participants_user_id_idx" ON "participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("type","status","created_at");--> statement-breakpoint
CREATE INDEX "posts_live_ping_idx" ON "posts" USING btree ("type","status","expires_at");