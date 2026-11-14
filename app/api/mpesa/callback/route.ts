import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { createPaymentConfirmationEmail } from "@/lib/email-templates";
import { queryMpesaStkPush } from "@/lib/mpesa";

type MpesaCallbackPayload = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{
          Name?: string;
          Value?: string | number;
        }>;
      };
    };
  };
};

function getMetadataValue(
  items: MpesaCallbackPayload["Body"] extends infer T
    ? NonNullable<
        NonNullable<T> extends { stkCallback?: infer S } ? S : never
      > extends infer C
      ? C extends { CallbackMetadata?: { Item?: infer I } }
        ? NonNullable<I>
        : never
      : never
    : never,
  name: string,
): string | number | undefined {
  return items.find((item) => item.Name === name)?.Value;
}

export async function POST(request: Request) {
  let claimedOrderId: string | null = null;
  const claimTime = new Date();
  const staleClaimBefore = new Date(Date.now() - 5 * 60 * 1000);

  try {
    const payload = (await request.json()) as MpesaCallbackPayload;

    const callback = payload.Body?.stkCallback;

    if (
      !callback?.MerchantRequestID ||
      !callback.CheckoutRequestID ||
      callback.ResultCode === undefined
    ) {
      return NextResponse.json(
        { error: "Invalid M-PESA callback payload." },
        { status: 400 },
      );
    }

    // Failed or cancelled payments remain pending until the
    // existing order-expiry process restores reserved stock.
    if (Number(callback.ResultCode) !== 0) {
      console.info(
        "M-PESA payment was not successful:",
        callback.CheckoutRequestID,
        callback.ResultDesc,
      );

      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: "Callback received.",
      });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID;

    // Locate the order before querying Safaricom.
    const [existingOrder] = await db
      .select({
        id: orders.id,
      })
      .from(orders)
      .where(eq(orders.mpesaCheckoutRequestId, checkoutRequestId))
      .limit(1);

    if (!existingOrder) {
      console.error(
        "No order found for M-PESA Checkout Request ID:",
        checkoutRequestId,
      );

      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Independently verify the transaction with Safaricom.
    const queryResult = await queryMpesaStkPush(checkoutRequestId);

    if (
      Number(queryResult.ResultCode) !== 0 ||
      queryResult.CheckoutRequestID !== checkoutRequestId ||
      queryResult.MerchantRequestID !== merchantRequestId
    ) {
      console.error(
        "M-PESA STK Query did not confirm the callback:",
        checkoutRequestId,
      );

      return NextResponse.json(
        { error: "M-PESA payment could not be verified." },
        { status: 500 },
      );
    }

    const items = callback.CallbackMetadata?.Item;

    if (!items) {
      return NextResponse.json(
        { error: "M-PESA payment metadata is missing." },
        { status: 400 },
      );
    }

    const amount = getMetadataValue(items, "Amount");
    const receiptNumber = getMetadataValue(items, "MpesaReceiptNumber");
    const phoneNumber = getMetadataValue(items, "PhoneNumber");

    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      typeof receiptNumber !== "string" ||
      !receiptNumber.trim() ||
      typeof phoneNumber !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid M-PESA payment metadata." },
        { status: 400 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, existingOrder.id))
        .for("update")
        .limit(1);

      if (
        !order ||
        order.paymentMethod !== "mpesa" ||
        order.mpesaCheckoutRequestId !== checkoutRequestId ||
        order.mpesaMerchantRequestId !== merchantRequestId ||
        order.mpesaPhoneNumber !== String(phoneNumber)
      ) {
        console.error(
          "M-PESA callback does not match the order:",
          existingOrder.id,
        );

        return { shouldSend: false };
      }

      const expectedAmount = Number(order.total);

      if (!Number.isSafeInteger(expectedAmount) || expectedAmount !== amount) {
        console.error("M-PESA payment amount mismatch:", existingOrder.id);

        return { shouldSend: false };
      }

      if (
        order.paymentStatus === "paid" &&
        order.mpesaReceiptNumber !== receiptNumber
      ) {
        console.error(
          "M-PESA receipt mismatch for an already-paid order:",
          existingOrder.id,
        );

        return { shouldSend: false };
      }

      if (order.paymentStatus !== "pending" && order.paymentStatus !== "paid") {
        return { shouldSend: false };
      }

      if (order.paymentStatus === "pending") {
        await tx
          .update(orders)
          .set({
            paymentStatus: "paid",
            mpesaReceiptNumber: receiptNumber,
            stockReservationExpiresAt: null,
          })
          .where(eq(orders.id, order.id));
      }

      // A late payment must not reopen an expired order.
      if (order.status === "cancelled" || order.stockRestoredAt) {
        console.error(
          "M-PESA payment received for an expired or cancelled order. Manual reconciliation required:",
          order.id,
        );

        return { shouldSend: false };
      }

      if (
        order.mpesaPaymentEmailSentAt ||
        (order.mpesaPaymentEmailClaimedAt &&
          order.mpesaPaymentEmailClaimedAt >= staleClaimBefore)
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
        console.error("Customer email not found for M-PESA order:", order.id);

        return { shouldSend: false };
      }

      await tx
        .update(orders)
        .set({
          mpesaPaymentEmailClaimedAt: claimTime,
        })
        .where(eq(orders.id, order.id));

      return {
        shouldSend: true,
        orderId: order.id,
        email: customer.email,
        customerName: order.shippingName || customer.name,
        total: order.total,
      };
    });

    if (
      !result.shouldSend ||
      !result.orderId ||
      !result.email ||
      !result.customerName ||
      !result.total
    ) {
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: "Callback received.",
      });
    }

    claimedOrderId = result.orderId;

    const emailContent = createPaymentConfirmationEmail({
      customerName: result.customerName,
      orderId: result.orderId,
      total: result.total,
      paymentMethod: "mpesa",
    });

    const emailResult = await sendEmail({
      to: result.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailResult.success) {
      throw new Error("M-PESA payment confirmation email failed.");
    }

    await db
      .update(orders)
      .set({
        mpesaPaymentEmailSentAt: new Date(),
        mpesaPaymentEmailClaimedAt: null,
      })
      .where(
        and(
          eq(orders.id, claimedOrderId),
          eq(orders.mpesaPaymentEmailClaimedAt, claimTime),
          isNull(orders.mpesaPaymentEmailSentAt),
        ),
      );

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Accepted.",
    });
  } catch (error) {
    console.error("M-PESA callback processing failed:", error);

    if (claimedOrderId) {
      await db
        .update(orders)
        .set({ mpesaPaymentEmailClaimedAt: null })
        .where(
          and(
            eq(orders.id, claimedOrderId),
            eq(orders.mpesaPaymentEmailClaimedAt, claimTime),
            isNull(orders.mpesaPaymentEmailSentAt),
          ),
        )
        .catch((dbError) => {
          console.error("Unable to release M-PESA email claim:", dbError);
        });
    }

    return NextResponse.json(
      { error: "Unable to process M-PESA callback." },
      { status: 500 },
    );
  }
}
