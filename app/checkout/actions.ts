"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cartItems, products, orders, orderItems } from "@/lib/db/schema";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { checkoutSchema } from "@/lib/validations/checkout";
import { sendEmail } from "@/lib/email";
import { createOrderConfirmationEmail } from "@/lib/email-templates";
import { stripe } from "@/lib/stripe";

type OrderCreationResult =
  | {
      success: false;
      message: string;
    }
  | {
      success: true;
      message: string;
      orderId: string;
      total: string;
      reservationExpiresAt: Date | null;
      paymentMethod: "mpesa" | "stripe" | "cash_on_delivery";
      items: {
        productId: string;
        name: string;
        price: string;
        quantity: number;
      }[];
    };

async function restoreFailedStripeOrder(orderId: string, userId: string) {
  await db.transaction(async (tx) => {
    // Lock the order and confirm it is still pending and unpaid.
    const [order] = await tx
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        stockRestoredAt: orders.stockRestoredAt,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .for("update")
      .limit(1);

    if (
      !order ||
      order.status !== "pending" ||
      order.paymentStatus !== "pending" ||
      order.stockRestoredAt
    ) {
      return;
    }

    // Retrieve the order items.
    const items = await tx
      .select({
        productId: orderItems.productId,
        productName: orderItems.productName,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Cancel the order and mark stock as restored.
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        stockRestoredAt: new Date(),
        stockReservationExpiresAt: null,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "pending"),
          eq(orders.paymentStatus, "pending"),
          isNull(orders.stockRestoredAt),
        ),
      );

    // Restore stock and return quantities to the cart.
    for (const item of items) {
      if (!item.productId) continue;

      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${item.quantity}`,
        })
        .where(eq(products.id, item.productId));

      await tx
        .insert(cartItems)
        .values({
          userId,
          productId: item.productId,
          quantity: item.quantity,
        })
        .onConflictDoUpdate({
          target: [cartItems.userId, cartItems.productId],
          set: {
            quantity: sql`${cartItems.quantity} + ${item.quantity}`,
          },
        });
    }
  });
}

export async function validateCheckout(input: unknown) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    return {
      success: false,
      message: "You must be logged in as a customer.",
    };
  }

  const result = checkoutSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      message: "Please check your delivery information.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  return {
    success: true,
    message: "Checkout information is valid.",
  };
}

export async function createOrder(input: unknown) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    return {
      success: false,
      message: "You must be logged in as a customer.",
    };
  }

  const userId = session.user.id;

  const validation = checkoutSchema.safeParse(input);

  if (!validation.success) {
    return {
      success: false,
      message: "Invalid checkout information.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const result: OrderCreationResult =
      await db.transaction<OrderCreationResult>(async (tx) => {
        const cart = await tx
          .select({
            productId: products.id,
            productName: products.name,
            price: products.price,
            quantity: cartItems.quantity,
            stock: products.stock,
          })
          .from(cartItems)
          .innerJoin(products, eq(cartItems.productId, products.id))
          .where(eq(cartItems.userId, userId));

        if (cart.length === 0) {
          return {
            success: false,
            message: "Your shopping cart is empty.",
          };
        }

        const unavailableItem = cart.find((item) => item.quantity > item.stock);

        if (unavailableItem) {
          return {
            success: false,
            message: `Insufficient stock for ${unavailableItem.productName}. Available stock: ${unavailableItem.stock}.`,
          };
        }

        for (const item of cart) {
          const updatedProducts = await tx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${item.quantity}`,
            })
            .where(
              and(
                eq(products.id, item.productId),
                gte(products.stock, item.quantity),
              ),
            )
            .returning({
              id: products.id,
            });

          if (updatedProducts.length === 0) {
            throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
          }
        }

        const totalCents = cart.reduce((total, item) => {
          const [whole, fraction = "00"] = item.price.split(".");

          const priceInCents =
            BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));

          return total + priceInCents * BigInt(item.quantity);
        }, BigInt(0));

        const orderTotal = `${totalCents / BigInt(100)}.${(
          totalCents % BigInt(100)
        )
          .toString()
          .padStart(2, "0")}`;

        const reservationExpiresAt =
          validation.data.paymentMethod === "cash_on_delivery"
            ? null
            : new Date(Date.now() + 15 * 60 * 1000);

        const [newOrder] = await tx
          .insert(orders)
          .values({
            userId,
            total: orderTotal,
            paymentMethod: validation.data.paymentMethod,
            stockReservationExpiresAt: reservationExpiresAt,
            shippingName: validation.data.shippingName,
            shippingPhone: validation.data.shippingPhone,
            shippingCounty: validation.data.shippingCounty,
            shippingTown: validation.data.shippingTown,
            shippingAddress: validation.data.shippingAddress,
            deliveryInstructions: validation.data.deliveryInstructions || null,
          })
          .returning({
            id: orders.id,
          });

        await tx.insert(orderItems).values(
          cart.map((item) => ({
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.price,
            quantity: item.quantity,
          })),
        );

        await tx.delete(cartItems).where(eq(cartItems.userId, userId));

        return {
          success: true,
          message: "Order created successfully.",
          orderId: newOrder.id,
          total: orderTotal,
          reservationExpiresAt,
          paymentMethod: validation.data.paymentMethod,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.productName,
            price: item.price,
            quantity: item.quantity,
          })),
        };
      });

    if (!result.success) {
      return result;
    }

    // Create Stripe Checkout Session
    if (result.paymentMethod === "stripe") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;

      if (!appUrl) {
        await restoreFailedStripeOrder(result.orderId, userId);

        return {
          success: false,
          message:
            "Stripe checkout is not configured. Your order was cancelled and items returned to your cart.",
        };
      }

      let checkoutSession: Awaited<
        ReturnType<typeof stripe.checkout.sessions.create>
      > | null = null;

      try {
        checkoutSession = await stripe.checkout.sessions.create({
          mode: "payment",

          line_items: result.items.map((item) => ({
            price_data: {
              currency: "kes",
              product_data: {
                name: item.name,
              },
              unit_amount: Math.round(Number(item.price) * 100),
            },
            quantity: item.quantity,
          })),

          client_reference_id: result.orderId,

          metadata: {
            orderId: result.orderId,
            userId,
          },

          success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url: `${appUrl}/checkout/cancel?order_id=${result.orderId}`,
        });

        if (!checkoutSession.url) {
          throw new Error("Stripe Checkout URL could not be created.");
        }

        await db
          .update(orders)
          .set({
            stripeCheckoutSessionId: checkoutSession.id,
          })
          .where(eq(orders.id, result.orderId));

        return {
          success: true,
          message: "Stripe Checkout Session created successfully.",
          orderId: result.orderId,
          checkoutUrl: checkoutSession.url,
        };
      } catch (error) {
        console.error("Stripe Checkout creation failed:", error);

        // Expire an existing session before restoring stock.
        if (checkoutSession) {
          try {
            await stripe.checkout.sessions.expire(checkoutSession.id);
          } catch (expireError) {
            console.error("Unable to expire Stripe session:", expireError);

            return {
              success: false,
              message:
                "Unable to safely cancel Stripe checkout. Please contact support.",
            };
          }
        }

        try {
          await restoreFailedStripeOrder(result.orderId, userId);
        } catch (restoreError) {
          console.error("Stripe order recovery failed:", restoreError);

          return {
            success: false,
            message:
              "Stripe checkout failed and automatic order recovery needs attention.",
          };
        }

        return {
          success: false,
          message:
            "Stripe checkout failed. Your order was cancelled and items returned to your cart.",
        };
      }
    }

    let emailSent = false;

    if (session.user.email) {
      try {
        const emailContent = createOrderConfirmationEmail({
          customerName: validation.data.shippingName,
          orderId: result.orderId,
          total: result.total,
          paymentMethod: result.paymentMethod,
          reservationExpiresAt: result.reservationExpiresAt,
        });

        const emailResult = await sendEmail({
          to: session.user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        emailSent = emailResult.success;
      } catch (emailError) {
        console.error("Order confirmation email failed:", emailError);
      }
    }

    return {
      success: true,
      message: emailSent
        ? "Order created successfully. Confirmation email sent."
        : "Order created successfully, but confirmation email could not be sent.",
      orderId: result.orderId,
      total: result.total,
      emailSent,
    };
  } catch (error) {
    console.error("Order preparation failed:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("INSUFFICIENT_STOCK:")
    ) {
      const productName = error.message.split(":")[1] || "Product";

      return {
        success: false,
        message: `Insufficient stock for ${productName}. Please update your cart.`,
      };
    }

    return {
      success: false,
      message: "Unable to prepare your order.",
    };
  }
}
