import { sql } from "drizzle-orm";
import {
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "stripe",
  "mpesa",
  "cash_on_delivery",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),

  email: varchar("email", { length: 255 }).notNull().unique(),

  passwordHash: text("password_hash").notNull(),

  role: userRoleEnum("role").default("customer").notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    description: text("description"),
    image: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("products_price_non_negative", sql`${table.price} >= 0`),
    check("products_stock_non_negative", sql`${table.stock} >= 0`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    total: numeric("total", { precision: 10, scale: 2 }).notNull(),

    status: orderStatusEnum("status").default("pending").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),

    paymentMethod: paymentMethodEnum("payment_method").notNull(),

    paymentStatus: paymentStatusEnum("payment_status")
      .default("pending")
      .notNull(),

    stockReservationExpiresAt: timestamp("stock_reservation_expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    stockRestoredAt: timestamp("stock_restored_at", {
      withTimezone: true,
      mode: "date",
    }),

    shippingName: varchar("shipping_name", { length: 255 }).notNull(),

    shippingPhone: varchar("shipping_phone", { length: 20 }).notNull(),

    shippingCounty: varchar("shipping_county", { length: 100 }).notNull(),

    shippingTown: varchar("shipping_town", { length: 100 }).notNull(),

    shippingAddress: text("shipping_address").notNull(),

    deliveryInstructions: text("delivery_instructions"),

    stripeCheckoutSessionId: text("stripe_checkout_session_id"),

    stripePaymentIntentId: text("stripe_payment_intent_id"),

    mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),

    mpesaReceiptNumber: varchar("mpesa_receipt_number", {
      length: 50,
    }),

    mpesaPhoneNumber: varchar("mpesa_phone_number", {
      length: 20,
    }),
  },
  (table) => [check("orders_total_non_negative", sql`${table.total} >= 0`)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),

    productName: varchar("product_name", { length: 255 }).notNull(),

    unitPrice: numeric("unit_price", {
      precision: 10,
      scale: 2,
    }).notNull(),

    quantity: integer("quantity").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("order_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    quantity: integer("quantity").notNull().default(1),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("cart_items_user_product_unique").on(table.userId, table.productId),
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);
