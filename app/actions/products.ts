"use server";

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { productSchema } from "@/lib/validations/product";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type ProductFormState = {
  success: boolean;
  message: string;
  errors: {
    name?: string[];
    price?: string[];
    stock?: string[];
    description?: string[];
    image?: string[];
  };
};

export type DeleteProductState = {
  success: boolean;
  message: string;
};

export async function createProduct(
  previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const rawData = {
    name: formData.get("name"),
    price: formData.get("price"),
    stock: Number(formData.get("stock")),
    description: formData.get("description") as string,
    image: formData.get("image") as string,
  };

  const validation = productSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors below.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, price, stock, description, image } = validation.data;

  try {
    await db.insert(products).values({
      name,
      price,
      stock,
      description,
      image,
    });

    revalidatePath("/admin/products");

    return {
      success: true,
      message: "Product created successfully!",
      errors: {},
    };
  } catch {
    return {
      success: false,
      message: "Something went wrong while creating the product.",
      errors: {},
    };
  }
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

export async function updateProduct(
  previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const id = formData.get("id") as string;

  const rawData = {
    name: formData.get("name"),
    price: formData.get("price"),
    stock: Number(formData.get("stock")),
    description: formData.get("description") as string,
    image: formData.get("image") as string,
  };

  const validation = productSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors below.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, price, stock, description, image } = validation.data;

  try {
    const updatedProduct = await db
      .update(products)
      .set({
        name,
        price,
        stock,
        description,
        image,
      })
      .where(eq(products.id, id))
      .returning();

    if (updatedProduct.length === 0) {
      return {
        success: false,
        message: "Product not found. It may have been deleted.",
        errors: {},
      };
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}/edit`);

    return {
      success: true,
      message: "Product updated successfully!",
      errors: {},
    };
  } catch {
    return {
      success: false,
      message: "Something went wrong while updating the product.",
      errors: {},
    };
  }
}

export async function deleteProduct(
  _previousState: DeleteProductState,
  formData: FormData,
): Promise<DeleteProductState> {
  const productId = formData.get("productId") as string;

  try {
    const deletedProduct = await db
      .delete(products)
      .where(eq(products.id, productId))
      .returning();

    if (deletedProduct.length === 0) {
      return {
        success: false,
        message: "Product not found. Nothing was deleted.",
      };
    }

    revalidatePath("/admin/products");

    return {
      success: true,
      message: "Product deleted successfully!",
    };
  } catch (error) {
    console.error("Failed to delete product:", error);

    return {
      success: false,
      message: "Unable to delete product. Please try again.",
    };
  }
}
