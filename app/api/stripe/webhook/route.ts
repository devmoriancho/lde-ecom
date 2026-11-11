import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const orderId = session.metadata?.orderId;

    if (!orderId) {
      console.error("Stripe session is missing its order ID:", session.id);
      return NextResponse.json({ received: true });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    try {
      await db.transaction(async (tx) => {
        const [order] = await tx
          .select({
            id: orders.id,
            status: orders.status,
            paymentStatus: orders.paymentStatus,
            stockRestoredAt: orders.stockRestoredAt,
          })
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              eq(orders.stripeCheckoutSessionId, session.id),
            ),
          )
          .for("update")
          .limit(1);

        if (
          !order ||
          order.status !== "pending" ||
          order.paymentStatus !== "pending" ||
          order.stockRestoredAt
        ) {
          console.error(
            "Stripe payment received for an order that cannot be marked paid:",
            orderId,
          );
          return;
        }

        await tx
          .update(orders)
          .set({
            paymentStatus: "paid",
            stripePaymentIntentId: paymentIntentId,
            stockReservationExpiresAt: null,
          })
          .where(eq(orders.id, orderId));
      });
    } catch (error) {
      console.error("Stripe webhook database update failed:", error);

      return NextResponse.json(
        { error: "Unable to update order payment status." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}
