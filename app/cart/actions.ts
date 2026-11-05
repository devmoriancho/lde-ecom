"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function updateCartQuantity(
  cartItemId: string,
  newQuantity: number,
) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    return {
      success: false,
      message: "Please log in as a customer.",
    };
  }

  if (
    !Number.isSafeInteger(newQuantity) ||
    newQuantity < 1 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cartItemId,
    )
  ) {
    return {
      success: false,
      message: "Invalid cart update.",
    };
  }

  const [item] = await db
    .select({
      id: cartItems.id,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(
      and(eq(cartItems.id, cartItemId), eq(cartItems.userId, session.user.id)),
    )
    .limit(1);

  if (!item) {
    return {
      success: false,
      message: "Cart item not found.",
    };
  }

  if (newQuantity > item.stock) {
    return {
      success: false,
      message: "Requested quantity exceeds available stock.",
    };
  }

  await db
    .update(cartItems)
    .set({ quantity: newQuantity })
    .where(
      and(eq(cartItems.id, cartItemId), eq(cartItems.userId, session.user.id)),
    );

  return {
    success: true,
    message: "Cart quantity updated successfully.",
  };
}

export async function removeFromCart(cartItemId: string) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    return {
      success: false,
      message: "Please log in as a customer.",
    };
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cartItemId,
    )
  ) {
    return {
      success: false,
      message: "Invalid cart item.",
    };
  }

  const deletedItems = await db
    .delete(cartItems)
    .where(
      and(eq(cartItems.id, cartItemId), eq(cartItems.userId, session.user.id)),
    )
    .returning({ id: cartItems.id });

  if (deletedItems.length === 0) {
    return {
      success: false,
      message: "Cart item not found.",
    };
  }

  return {
    success: true,
    message: "Product removed from cart successfully.",
  };
}
