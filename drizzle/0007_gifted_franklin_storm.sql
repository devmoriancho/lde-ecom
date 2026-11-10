ALTER TABLE "orders" ADD COLUMN "payment_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "expiry_email_sent_at" timestamp with time zone;