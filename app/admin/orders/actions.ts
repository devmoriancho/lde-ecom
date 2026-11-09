"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/lib/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Global Schema Declarations
const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

const allowedOrderTransitions = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
} as const;

const updatePaymentStatusSchema = z.object({
  orderId: z.string().uuid(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]),
});

export async function updateOrderStatus(input: unknown) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return {
      success: false,
      message: "Unauthorized. Admin access required.",
    };
  }

  const validation = updateOrderStatusSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      message: "Invalid order ID or order status.",
    };
  }

  try {
    const [existingOrder] = await db
      .select({
        id: orders.id,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        stockRestoredAt: orders.stockRestoredAt,
      })
      .from(orders)
      .where(eq(orders.id, validation.data.orderId))
      .limit(1);

    if (!existingOrder) {
      return {
        success: false,
        message: "Order not found.",
      };
    }

    if (
      validation.data.status === "delivered" &&
      existingOrder.paymentMethod === "cash_on_delivery" &&
      existingOrder.paymentStatus !== "paid"
    ) {
      return {
        success: false,
        message:
          "Cash on Delivery payment must be collected before marking the order as delivered.",
      };
    }

    if (
      validation.data.status === "cancelled" &&
      existingOrder.paymentStatus === "paid"
    ) {
      return {
        success: false,
        message: "Paid orders must be refunded before they can be cancelled.",
      };
    }

    const allowedStatuses: readonly string[] =
      allowedOrderTransitions[existingOrder.status];

    if (!allowedStatuses.includes(validation.data.status)) {
      return {
        success: false,
        message: `Cannot change order status from ${existingOrder.status} to ${validation.data.status}.`,
      };
    }

    const updatedOrder = await db.transaction(async (tx) => {
      const [lockedOrder] = await tx
        .select({
          id: orders.id,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          paymentStatus: orders.paymentStatus,
          stockRestoredAt: orders.stockRestoredAt,
        })
        .from(orders)
        .where(eq(orders.id, validation.data.orderId))
        .for("update")
        .limit(1);

      if (!lockedOrder) {
        throw new Error("ORDER_NOT_FOUND");
      }

      if (
        lockedOrder.status !== existingOrder.status ||
        lockedOrder.paymentStatus !== existingOrder.paymentStatus
      ) {
        throw new Error("ORDER_CHANGED");
      }

      const currentAllowedStatuses: readonly string[] =
        allowedOrderTransitions[lockedOrder.status];

      if (!currentAllowedStatuses.includes(validation.data.status)) {
        throw new Error("INVALID_ORDER_TRANSITION");
      }

      if (validation.data.status === "cancelled") {
        const items = await tx
          .select({
            productId: orderItems.productId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, validation.data.orderId));

        const restorationClaim = await tx
          .update(orders)
          .set({
            stockRestoredAt: new Date(),
            stockReservationExpiresAt: null,
          })
          .where(
            and(
              eq(orders.id, validation.data.orderId),
              isNull(orders.stockRestoredAt),
            ),
          )
          .returning({
            id: orders.id,
          });

        if (restorationClaim.length > 0) {
          for (const item of items) {
            if (!item.productId) {
              continue;
            }

            await tx
              .update(products)
              .set({
                stock: sql`${products.stock} + ${item.quantity}`,
              })
              .where(eq(products.id, item.productId));
          }
        }
      }

      const result = await tx
        .update(orders)
        .set({
          status: validation.data.status,
        })
        .where(
          and(
            eq(orders.id, validation.data.orderId),
            eq(orders.status, lockedOrder.status),
          ),
        )
        .returning({
          id: orders.id,
        });

      return result;
    });

    if (updatedOrder.length === 0) {
      return {
        success: false,
        message: "Order not found.",
      };
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${validation.data.orderId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${validation.data.orderId}`);

    return {
      success: true,
      message: "Order status updated successfully.",
    };
  } catch (error) {
    console.error("Order status update failed:", error);

    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") {
        return { success: false, message: "Order not found." };
      }
      if (error.message === "ORDER_CHANGED") {
        return {
          success: false,
          message:
            "Order status was updated by another request. Please refresh.",
        };
      }
      if (error.message === "INVALID_ORDER_TRANSITION") {
        return {
          success: false,
          message: "The requested order status transition is invalid.",
        };
      }
    }

    return {
      success: false,
      message: "Could not update order status.",
    };
  }
}

export async function updatePaymentStatus(input: unknown) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return {
      success: false,
      message: "Unauthorized. Admin access required.",
    };
  }

  const validation = updatePaymentStatusSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      message: "Invalid order ID or payment status.",
    };
  }

  try {
    const [existingOrder] = await db
      .select({
        id: orders.id,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.id, validation.data.orderId))
      .limit(1);

    if (!existingOrder) {
      return {
        success: false,
        message: "Order not found.",
      };
    }

    if (
      validation.data.paymentStatus === "paid" &&
      existingOrder.paymentMethod !== "cash_on_delivery"
    ) {
      return {
        success: false,
        message: "Online payments must be confirmed by the payment provider.",
      };
    }

    const updatedOrder = await db
      .update(orders)
      .set({
        paymentStatus: validation.data.paymentStatus,
      })
      .where(
        and(
          eq(orders.id, validation.data.orderId),
          eq(orders.paymentMethod, "cash_on_delivery"),
          ne(orders.status, "cancelled"),
        ),
      )
      .returning({
        id: orders.id,
      });

    if (updatedOrder.length === 0) {
      return {
        success: false,
        message: "Only Cash on Delivery payments can be updated manually.",
      };
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${validation.data.orderId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${validation.data.orderId}`);

    return {
      success: true,
      message: "Payment status updated successfully.",
    };
  } catch (error) {
    console.error("Payment status update failed:", error);

    return {
      success: false,
      message: "Could not update payment status.",
    };
  }
}
