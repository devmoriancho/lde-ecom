"use server";

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function createProduct() {
  const newProduct = await db
    .insert(products)
    .values({
      name: "Wireless Headphones",
      price: "49.99",
      stock: 20,
      description: "Bluetooth wireless headphones",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnuUdCijgjKUrEFz-D1ofr7DCJRYHmuCfoeIeccmAXrA&s=10",
    })
    .returning();

  return newProduct;
}

export async function updateProductStock(productId: string, newStock: number) {
  const updatedProduct = await db
    .update(products)
    .set({
      stock: newStock,
    })
    .where(eq(products.id, productId))
    .returning();

  return updatedProduct;
}

export async function deleteProduct(productId: string) {
  const deletedProduct = await db
    .delete(products)
    .where(eq(products.id, productId))
    .returning();

  return deletedProduct;
}
