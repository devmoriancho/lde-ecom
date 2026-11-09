ALTER TABLE "orders" ADD COLUMN "stock_reservation_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stock_restored_at" timestamp with time zone;