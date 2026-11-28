"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function addToCart(productId: string) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    return {
      success: false,
      message: "Please log in as a customer to add products.",
    };
  }
  const userId = session.user.id;
  try {
    return await db.transaction(async (tx) => {
      // Lock the product row to prevent concurrent stock checks.
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
        .for("update");

      if (!product) {
        return {
          success: false,
          message: "Product not found.",
        };
      }

      if (product.stock <= 0) {
        return {
          success: false,
          message: "This product is out of stock.",
        };
      }

      const [existingItem] = await tx
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

      if (existingItem) {
        await tx
          .update(cartItems)
          .set({
            quantity: existingItem.quantity + 1,
          })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        await tx.insert(cartItems).values({
          userId,
          productId,
          quantity: 1,
        });
      }

      return {
        success: true,
        message: "Product added to cart successfully!",
      };
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    return {
      success: false,
      message: "Unable to add this product. Please try again.",
    };
  }
}
