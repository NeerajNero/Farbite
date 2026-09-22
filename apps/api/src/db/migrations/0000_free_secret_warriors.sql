CREATE TYPE "public"."drop_status" AS ENUM('draft', 'open', 'closed', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'payment_submitted', 'paid', 'payment_rejected', 'expired', 'cancelled', 'refund_pending', 'refunded', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('manual_upi', 'razorpay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'submitted', 'verified', 'rejected', 'refund_pending', 'refunded', 'failed');--> statement-breakpoint
CREATE TABLE "delivery_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"landmark" text,
	"handover_notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drop_delivery_points" (
	"drop_id" uuid NOT NULL,
	"delivery_point_id" uuid NOT NULL,
	CONSTRAINT "drop_delivery_points_drop_id_delivery_point_id_pk" PRIMARY KEY("drop_id","delivery_point_id")
);
--> statement-breakpoint
CREATE TABLE "drop_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_paise" integer NOT NULL,
	"cost_price_paise" integer,
	"is_veg" boolean DEFAULT true NOT NULL,
	"max_qty_per_order" integer DEFAULT 5 NOT NULL,
	"max_total_qty" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "drop_status" DEFAULT 'draft' NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"delivery_starts_at" timestamp with time zone NOT NULL,
	"delivery_ends_at" timestamp with time zone NOT NULL,
	"min_orders" integer NOT NULL,
	"max_orders" integer NOT NULL,
	"delivery_fee_paise" integer DEFAULT 0 NOT NULL,
	"customer_notes" text,
	"internal_notes" text,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"out_for_delivery_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"drop_id" uuid,
	"order_id" uuid,
	"actor" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"drop_item_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"qty" integer NOT NULL,
	"line_total_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "order_items_qty_positive" CHECK ("order_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"access_token" text NOT NULL,
	"idempotency_key" text,
	"drop_id" uuid NOT NULL,
	"user_id" uuid,
	"delivery_point_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_note" text,
	"refund_upi_id" text,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"delivery_fee_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"client_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "orders_code_unique" UNIQUE("code"),
	CONSTRAINT "orders_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_status" NOT NULL,
	"amount_paise" integer NOT NULL,
	"upi_ref" text,
	"submitted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"rejection_reason" text,
	"refund_ref" text,
	"provider_order_id" text,
	"provider_payment_id" text,
	"provider_refund_id" text,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "payments_upi_ref_unique" UNIQUE("upi_ref")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"address" text,
	"phone" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"phone" text,
	"default_delivery_point_id" uuid,
	"is_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "drop_delivery_points" ADD CONSTRAINT "drop_delivery_points_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_delivery_points" ADD CONSTRAINT "drop_delivery_points_delivery_point_id_delivery_points_id_fk" FOREIGN KEY ("delivery_point_id") REFERENCES "public"."delivery_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_items" ADD CONSTRAINT "drop_items_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_drop_item_id_drop_items_id_fk" FOREIGN KEY ("drop_item_id") REFERENCES "public"."drop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_point_id_delivery_points_id_fk" FOREIGN KEY ("delivery_point_id") REFERENCES "public"."delivery_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_delivery_point_id_delivery_points_id_fk" FOREIGN KEY ("default_delivery_point_id") REFERENCES "public"."delivery_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_drop_id_type_idx" ON "events" USING btree ("drop_id","type");--> statement-breakpoint
CREATE INDEX "orders_drop_id_status_idx" ON "orders" USING btree ("drop_id","status");--> statement-breakpoint
CREATE INDEX "orders_customer_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");