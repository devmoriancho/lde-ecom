import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { createOrderConfirmationEmail } from "@/lib/email-templates";
import Stripe from "stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing webhook signature or configuration." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const orderId = session.metadata?.orderId;
  const userId = session.metadata?.userId;

  if (!orderId || !userId) {
    console.error("Stripe session is missing order or user metadata.");
    return NextResponse.json({ error: "Missing metadata." }, { status: 400 });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const claimTime = new Date();
  const staleClaimBefore = new Date(Date.now() - 5 * 60 * 1000);

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.userId, userId),
            eq(orders.stripeCheckoutSessionId, session.id),
          ),
        )
        .for("update")
        .limit(1);

      if (
        !order ||
        order.paymentMethod !== "stripe" ||
        order.status === "cancelled" ||
        order.stockRestoredAt
      ) {
        console.error("Stripe payment does not match a valid order:", orderId);
        return { shouldSend: false };
      }

      if (
        session.currency?.toLowerCase() !== "kes" ||
        session.amount_total === null ||
        Math.round(Number(order.total) * 100) !== session.amount_total
      ) {
        console.error("Stripe payment amount or currency mismatch:", orderId);
        return { shouldSend: false };
      }

      if (order.paymentStatus === "pending") {
        await tx
          .update(orders)
          .set({
            paymentStatus: "paid",
            stripePaymentIntentId: paymentIntentId,
            stockReservationExpiresAt: null,
          })
          .where(eq(orders.id, orderId));
      } else if (order.paymentStatus !== "paid") {
        return { shouldSend: false };
      }

      if (
        order.stripePaymentEmailSentAt ||
        (order.stripePaymentEmailClaimedAt &&
          order.stripePaymentEmailClaimedAt >= staleClaimBefore)
      ) {
        return { shouldSend: false };
      }

      const [customer] = await tx
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1);

      if (!customer?.email) {
        console.error("Customer email not found for order:", orderId);
        return { shouldSend: false };
      }

      await tx
        .update(orders)
        .set({ stripePaymentEmailClaimedAt: claimTime })
        .where(eq(orders.id, orderId));

      return {
        shouldSend: true,
        email: customer.email,
        customerName: order.shippingName || customer.name || "Customer",
        total: order.total,
      };
    });

    if (
      !result.shouldSend ||
      !result.email ||
      !result.customerName ||
      result.total === undefined
    ) {
      return NextResponse.json({ received: true });
    }

    const emailContent = createOrderConfirmationEmail({
      customerName: result.customerName,
      orderId,
      total: result.total,
      paymentMethod: "stripe",
      paymentStatus: "paid",
      reservationExpiresAt: null,
    });

    const emailResult = await sendEmail({
      to: result.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailResult.success) {
      throw new Error("Stripe payment confirmation email failed.");
    }

    await db
      .update(orders)
      .set({
        stripePaymentEmailSentAt: new Date(),
        stripePaymentEmailClaimedAt: null,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.stripePaymentEmailClaimedAt, claimTime),
          isNull(orders.stripePaymentEmailSentAt),
        ),
      );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe payment confirmation email failed:", error);

    await db
      .update(orders)
      .set({ stripePaymentEmailClaimedAt: null })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.stripePaymentEmailClaimedAt, claimTime),
          isNull(orders.stripePaymentEmailSentAt),
        ),
      )
      .catch((dbError) => {
        console.error("Unable to release Stripe email claim:", dbError);
      });

    return NextResponse.json(
      { error: "Unable to complete Stripe payment confirmation." },
      { status: 500 },
    );
  }
}
