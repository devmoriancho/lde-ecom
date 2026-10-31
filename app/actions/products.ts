"use server";

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

export async function createProduct() {
  const newProduct = await db
    .insert(products)
    .values({
      name: "Wireless Headphones",
      price: "49.99",
      stock: 20,
      description: "Bluetooth wireless headphones",
      image: "",
    })
    .returning();

  return newProduct;
}
