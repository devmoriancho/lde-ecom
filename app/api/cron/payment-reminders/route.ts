import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { and, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { createPaymentReminderEmail } from "@/lib/email-templates";

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

  const reminderCutoff = new Date(now.getTime() + 5 * 60 * 1000);

  // Recover claims abandoned for more than 10 minutes.
  const staleClaimBefore = new Date(now.getTime() - 10 * 60 * 1000);

  try {
    // PHASE 1: Claim eligible orders inside a short transaction.
    const claimedOrders = await db.transaction(async (tx) => {
      const dueOrders = await tx
        .select({
          id: orders.id,
          userId: orders.userId,
        })
        .from(orders)
        .where(
          and(
            eq(orders.status, "pending"),
            eq(orders.paymentStatus, "pending"),
            inArray(orders.paymentMethod, ["mpesa", "stripe"]),
            gt(orders.stockReservationExpiresAt, now),
            lte(orders.stockReservationExpiresAt, reminderCutoff),
            isNull(orders.paymentReminderSentAt),
            or(
              isNull(orders.paymentReminderClaimedAt),
              lt(orders.paymentReminderClaimedAt, staleClaimBefore),
            ),
          ),
        )
        .for("update", { skipLocked: true });

      if (dueOrders.length === 0) {
        return [];
      }

      const orderIds = dueOrders.map((order) => order.id);

      const claimed = await tx
        .update(orders)
        .set({
          paymentReminderClaimedAt: claimTime,
        })
        .where(inArray(orders.id, orderIds))
        .returning({
          id: orders.id,
          userId: orders.userId,
          total: orders.total,
          shippingName: orders.shippingName,
          reservationExpiresAt: orders.stockReservationExpiresAt,
        });

      const userIds = [...new Set(claimed.map((order) => order.userId))];

      const customerEmails =
        userIds.length > 0
          ? await tx
              .select({
                id: users.id,
                email: users.email,
              })
              .from(users)
              .where(inArray(users.id, userIds))
          : [];

      const emailMap = new Map(
        customerEmails.map((user) => [user.id, user.email]),
      );

      return claimed.map((order) => ({
        ...order,
        email: emailMap.get(order.userId) ?? null,
      }));
    });

    // PHASE 2: Send emails outside the database transaction.
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const order of claimedOrders) {
      const releaseClaim = async () => {
        await db
          .update(orders)
          .set({
            paymentReminderClaimedAt: null,
          })
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.paymentReminderClaimedAt, claimTime),
              isNull(orders.paymentReminderSentAt),
            ),
          );
      };

      try {
        if (!order.email || !order.reservationExpiresAt) {
          await releaseClaim();
          skipped++;
          continue;
        }

        // Recheck eligibility before sending.
        const [currentOrder] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.status, "pending"),
              eq(orders.paymentStatus, "pending"),
              inArray(orders.paymentMethod, ["mpesa", "stripe"]),
              gt(orders.stockReservationExpiresAt, new Date()),
              isNull(orders.paymentReminderSentAt),
              eq(orders.paymentReminderClaimedAt, claimTime),
            ),
          )
          .limit(1);

        if (!currentOrder) {
          await releaseClaim();
          skipped++;
          continue;
        }

        const emailContent = createPaymentReminderEmail({
          customerName: order.shippingName,
          orderId: order.id,
          total: order.total,
          reservationExpiresAt: order.reservationExpiresAt,
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
            paymentReminderSentAt: new Date(),
            paymentReminderClaimedAt: null,
          })
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.paymentReminderClaimedAt, claimTime),
              isNull(orders.paymentReminderSentAt),
            ),
          );

        sent++;
      } catch (emailError) {
        console.error(
          `Payment reminder failed for order ${order.id}:`,
          emailError,
        );

        try {
          await releaseClaim();
        } catch (releaseError) {
          console.error(
            `Unable to release reminder claim for order ${order.id}:`,
            releaseError,
          );
        }

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment reminder check completed.",
      checked: claimedOrders.length,
      sent,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("Payment reminder cron failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process payment reminders.",
      },
      { status: 500 },
    );
  }
}
