"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function addToCart(productId: string) {
  // 1. Identify the logged-in customer
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    return {
      success: false,
      message: "Please log in as a customer to add products.",
    };
  }

  const userId = session.user.id;

  // 2. Find the selected product
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    return {
      success: false,
      message: "Product not found.",
    };
  }

  // 3. Check product availability
  if (product.stock <= 0) {
    return {
      success: false,
      message: "This product is out of stock.",
    };
  }

  // 4. Check whether the product is already in the cart
  const [existingItem] = await db
    .select()
    .from(cartItems)
    .where(
      and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
    )
    .limit(1);

  if (existingItem && existingItem.quantity >= product.stock) {
    return {
      success: false,
      message: "You cannot add more than the available stock.",
    };
  }

  // 5. Insert the product or increase its quantity
  await db
    .insert(cartItems)
    .values({
      userId,
      productId,
      quantity: 1,
    })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.productId],
      set: {
        quantity: sql`${cartItems.quantity} + 1`,
      },
    });

  return {
    success: true,
    message: "Product added to cart successfully!",
  };
}
