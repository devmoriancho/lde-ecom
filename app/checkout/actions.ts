"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cartItems, products, orders, orderItems } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { checkoutSchema } from "@/lib/validations/checkout";

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
    const result = await db.transaction(async (tx) => {
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
      };
    });

    return result;
  } catch (error) {
    console.error("Order preparation failed:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("INSUFFICIENT_STOCK:")
    ) {
      const productName = error.message.split(":");

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
