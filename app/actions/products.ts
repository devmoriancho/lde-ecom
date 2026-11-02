"use server";

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function createProduct(formData: FormData) {
  const name = formData.get("name") as string;
  const price = formData.get("price") as string;
  const stock = Number(formData.get("stock"));
  const description = formData.get("description") as string;
  const image = formData.get("image") as string;

  const newProduct = await db
    .insert(products)
    .values({
      name,
      price,
      stock,
      description,
      image,
    })
    .returning();

  console.log("Product created:", newProduct);
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

export async function updateProduct(formData: FormData) {
  const id = formData.get("id") as string;

  const name = formData.get("name") as string;
  const price = formData.get("price") as string;
  const stock = Number(formData.get("stock"));
  const description = formData.get("description") as string;
  const image = formData.get("image") as string;

  await db
    .update(products)
    .set({
      name,
      price,
      stock,
      description,
      image,
    })
    .where(eq(products.id, id));
}

export async function deleteProduct(productId: string) {
  const deletedProduct = await db
    .delete(products)
    .where(eq(products.id, productId))
    .returning();

  return deletedProduct;
}
