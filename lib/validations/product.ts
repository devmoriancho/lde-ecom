import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),

  price: z
    .string()
    .trim()
    .min(1, "Price is required")
    .refine((value) => {
      const price = Number(value);
      return Number.isFinite(price) && price >= 0;
    }, "Price must be a valid non-negative number"),

  stock: z
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative"),

  description: z.string().optional(),

  image: z
    .union([z.literal(""), z.string().url("Enter a valid image URL")])
    .optional(),
});
