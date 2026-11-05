CREATE TYPE "public"."payment_method" AS ENUM('stripe', 'mpesa', 'cash_on_delivery');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" "payment_method" NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "payment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mpesa_checkout_request_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mpesa_receipt_number" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mpesa_phone_number" varchar(20);