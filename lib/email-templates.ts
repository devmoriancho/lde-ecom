type OrderConfirmationEmailInput = {
  customerName: string;
  orderId: string;
  total: string;
  paymentMethod: "mpesa" | "stripe" | "cash_on_delivery";
  reservationExpiresAt: Date | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export function createOrderConfirmationEmail({
  customerName,
  orderId,
  total,
  paymentMethod,
  reservationExpiresAt,
}: OrderConfirmationEmailInput) {
  const safeName = escapeHtml(customerName);
  const safeOrderId = escapeHtml(orderId);
  const safeTotal = escapeHtml(total);

  const paymentLabels = {
    mpesa: "M-PESA",
    stripe: "Stripe",
    cash_on_delivery: "Cash on Delivery",
  };

  const paymentLabel = paymentLabels[paymentMethod];

  const paymentMessage =
    paymentMethod === "cash_on_delivery"
      ? "You selected Cash on Delivery. Payment will be collected when your order is delivered."
      : "Your payment is currently pending. Please follow the payment instructions provided during checkout.";

  const expiryMessage =
    paymentMethod !== "cash_on_delivery" && reservationExpiresAt
      ? `Your stock reservation expires on ${reservationExpiresAt.toLocaleString("en-KE")}.`
      : "";

  return {
    subject: `Order confirmation - ${orderId.slice(0, 8)}`,

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Thank you for your order, ${safeName}!</h2>

        <p>Your order has been successfully created.</p>

        <div style="background: #f4f4f4; padding: 16px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${safeOrderId}</p>
          <p><strong>Total:</strong> KSh ${safeTotal}</p>
          <p><strong>Payment method:</strong> ${paymentLabel}</p>
        </div>

        <p>${paymentMessage}</p>

        ${expiryMessage ? `<p>${escapeHtml(expiryMessage)}</p>` : ""}

        <p>Thank you for shopping with us!</p>

        <p style="color: #777; font-size: 12px;">
          This is an automated email. Please do not reply.
        </p>
      </div>
    `,

    text: `
Thank you for your order, ${customerName}!

Your order has been successfully created.

Order ID: ${orderId}
Total: KSh ${total}
Payment method: ${paymentLabel}

${paymentMessage}

${expiryMessage}

Thank you for shopping with us!
    `.trim(),
  };
}

type PaymentReminderEmailInput = {
  customerName: string;
  orderId: string;
  total: string;
  reservationExpiresAt: Date;
};

export function createPaymentReminderEmail({
  customerName,
  orderId,
  total,
  reservationExpiresAt,
}: PaymentReminderEmailInput) {
  const safeName = escapeHtml(customerName);
  const safeOrderId = escapeHtml(orderId);
  const safeTotal = escapeHtml(total);

  const expiryDate = reservationExpiresAt.toLocaleString("en-KE");

  return {
    subject: `Payment reminder - Order ${orderId.slice(0, 8)}`,

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333;">
        <h2 style="color: #111;">Hello ${safeName},</h2>

        <p>Your order is still awaiting payment.</p>

        <div style="background: #fff7ed; padding: 16px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${safeOrderId}</p>
          <p><strong>Amount due:</strong> KSh ${safeTotal}</p>
          <p><strong>Reservation expires:</strong> ${escapeHtml(expiryDate)}</p>
        </div>

        <p>Please complete your payment before your reservation expires.</p>

        <p>If payment is not completed before expiry, your order will be cancelled and reserved stock released.</p>

        <p>Thank you for shopping with us!</p>
      </div>
    `,

    text: `
Hello ${customerName},

Your order is still awaiting payment.

Order ID: ${orderId}
Amount due: KSh ${total}
Reservation expires: ${expiryDate}

Please complete your payment before your reservation expires.

If payment is not completed before expiry, your order will be cancelled and reserved stock released.

Thank you for shopping with us!
    `.trim(),
  };
}

type OrderExpiryEmailInput = {
  customerName: string;
  orderId: string;
  total: string;
};

export function createOrderExpiryEmail({
  customerName,
  orderId,
  total,
}: OrderExpiryEmailInput) {
  const safeName = escapeHtml(customerName);
  const safeOrderId = escapeHtml(orderId);
  const safeTotal = escapeHtml(total);

  return {
    subject: `Order expired - ${orderId.slice(0, 8)}`,

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333;">
        <h2>Hello ${safeName},</h2>

        <p>Your order has expired because payment was not completed within the reservation period.</p>

        <div style="background: #fef2f2; padding: 16px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${safeOrderId}</p>
          <p><strong>Order total:</strong> KSh ${safeTotal}</p>
          <p><strong>Status:</strong> Cancelled</p>
        </div>

        <p>The reserved stock has been released and is now available for other customers.</p>

        <p>You are welcome to place a new order whenever you are ready.</p>

        <p>Thank you for considering our store!</p>
      </div>
    `,

    text: `
Hello ${customerName},

Your order has expired because payment was not completed within the reservation period.

Order ID: ${orderId}
Order total: KSh ${total}
Status: Cancelled

The reserved stock has been released.

You are welcome to place a new order whenever you are ready.

Thank you for considering our store!
    `.trim(),
  };
}

type PaymentConfirmationEmailInput = {
  customerName: string;
  orderId: string;
  total: string;
  paymentMethod: "mpesa" | "stripe";
};

export function createPaymentConfirmationEmail({
  customerName,
  orderId,
  total,
  paymentMethod,
}: PaymentConfirmationEmailInput) {
  const safeName = escapeHtml(customerName);
  const safeOrderId = escapeHtml(orderId);
  const safeTotal = escapeHtml(total);

  const paymentLabel = paymentMethod === "mpesa" ? "M-PESA" : "Stripe";

  return {
    subject: `Payment received - Order ${orderId.slice(0, 8)}`,

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333;">
        <h2>Hello ${safeName},</h2>

        <p>Great news! Your payment has been successfully verified.</p>

        <div style="background: #ecfdf5; padding: 16px; border-radius: 8px;">
          <p><strong>Order ID:</strong> ${safeOrderId}</p>
          <p><strong>Amount paid:</strong> KSh ${safeTotal}</p>
          <p><strong>Payment method:</strong> ${paymentLabel}</p>
          <p><strong>Payment status:</strong> Paid</p>
        </div>

        <p>Your order is now confirmed for processing.</p>

        <p>Thank you for shopping with us!</p>
      </div>
    `,

    text: `
Hello ${customerName},

Your payment has been successfully verified.

Order ID: ${orderId}
Amount paid: KSh ${total}
Payment method: ${paymentLabel}
Payment status: Paid

Your order is now confirmed for processing.

Thank you for shopping with us!
    `.trim(),
  };
}
