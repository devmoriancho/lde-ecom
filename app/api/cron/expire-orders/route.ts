import { db } from "@/lib/db";
import { orders, orderItems, products, users } from "@/lib/db/schema";
import {
  and,
  eq,
  inArray,
  isNull,
  isNotNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { createOrderExpiryEmail } from "@/lib/email-templates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { success: false, message: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const now = new Date();
  const claimTime = new Date();

  // Recover email claims abandoned for more than 10 minutes.
  const staleClaimBefore = new Date(now.getTime() - 10 * 60 * 1000);

  try {
    // PHASE 1: Expire orders, restore stock and claim expiry emails.
    const claimedOrders = await db.transaction(async (tx) => {
      console.log("Expiry claim column:", orders.expiryEmailClaimedAt);
      console.log("Expiry sent column:", orders.expiryEmailSentAt);
      const dueOrders = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
          status: orders.status,
          total: orders.total,
          shippingName: orders.shippingName,
        })
        .from(orders)
        .where(
          and(
            inArray(orders.paymentMethod, ["mpesa", "stripe"]),
            isNull(orders.expiryEmailSentAt),
            or(
              isNull(orders.expiryEmailClaimedAt),
              lt(orders.expiryEmailClaimedAt, staleClaimBefore),
            ),
            or(
              // Newly expired unpaid orders.
              and(
                eq(orders.status, "pending"),
                eq(orders.paymentStatus, "pending"),
                lte(orders.stockReservationExpiresAt, now),
                isNull(orders.stockRestoredAt),
              ),

              // Previously cancelled orders whose expiry email
              // still needs to be sent.
              and(
                eq(orders.status, "cancelled"),
                isNotNull(orders.stockRestoredAt),
              ),
            ),
          ),
        )
        .for("update", { skipLocked: true });

      if (dueOrders.length === 0) {
        return [];
      }

      const processedOrders = [];

      for (const order of dueOrders) {
        if (order.status === "pending") {
          // Cancel the order and mark stock as restored.
          await tx
            .update(orders)
            .set({
              status: "cancelled",
              stockRestoredAt: claimTime,
              stockReservationExpiresAt: null,
              expiryEmailClaimedAt: claimTime,
            })
            .where(
              and(
                eq(orders.id, order.id),
                eq(orders.status, "pending"),
                eq(orders.paymentStatus, "pending"),
                isNull(orders.stockRestoredAt),
              ),
            );

          // Retrieve the order's items.
          const items = await tx
            .select({
              productId: orderItems.productId,
              quantity: orderItems.quantity,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

          // Restore each product's reserved stock.
          for (const item of items) {
            if (!item.productId) continue;

            await tx
              .update(products)
              .set({
                stock: sql`${products.stock} + ${item.quantity}`,
              })
              .where(eq(products.id, item.productId));
          }
        } else {
          // Retry an expiry email for an already-cancelled order.
          await tx
            .update(orders)
            .set({
              expiryEmailClaimedAt: claimTime,
            })
            .where(
              and(
                eq(orders.id, order.id),
                eq(orders.status, "cancelled"),
                isNotNull(orders.stockRestoredAt),
                isNull(orders.expiryEmailSentAt),
              ),
            );
        }

        const [customer] = await tx
          .select({
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, order.userId))
          .limit(1);

        processedOrders.push({
          ...order,
          email: customer?.email ?? null,
        });
      }

      return processedOrders;
    });

    // PHASE 2: Send expiry emails outside the transaction.
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const order of claimedOrders) {
      const releaseClaim = async () => {
        await db
          .update(orders)
          .set({
            expiryEmailClaimedAt: null,
          })
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.expiryEmailClaimedAt, claimTime),
              isNull(orders.expiryEmailSentAt),
            ),
          );
      };

      try {
        if (!order.email) {
          await releaseClaim();
          skipped++;
          continue;
        }

        // Recheck the order before sending its email.
        const [currentOrder] = await db
          .select({
            id: orders.id,
          })
          .from(orders)
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.status, "cancelled"),
              eq(orders.paymentStatus, "pending"),
              isNotNull(orders.stockRestoredAt),
              isNull(orders.expiryEmailSentAt),
              eq(orders.expiryEmailClaimedAt, claimTime),
            ),
          )
          .limit(1);

        if (!currentOrder) {
          await releaseClaim();
          skipped++;
          continue;
        }

        const emailContent = createOrderExpiryEmail({
          customerName: order.shippingName,
          orderId: order.id,
          total: order.total,
        });

        const emailResult = await sendEmail({
          to: order.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        if (!emailResult.success) {
          await releaseClaim();
          failed++;
          continue;
        }

        await db
          .update(orders)
          .set({
            expiryEmailSentAt: new Date(),
            expiryEmailClaimedAt: null,
          })
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.expiryEmailClaimedAt, claimTime),
              isNull(orders.expiryEmailSentAt),
            ),
          );

        sent++;
      } catch (emailError) {
        console.error(
          `Order expiry email failed for order ${order.id}:`,
          emailError,
        );

        try {
          await releaseClaim();
        } catch (releaseError) {
          console.error(
            `Unable to release expiry email claim for order ${order.id}:`,
            releaseError,
          );
        }

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order expiry check completed.",
      checked: claimedOrders.length,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("Order expiry cron failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process expired orders.",
      },
      { status: 500 },
    );
  }
}
