import { z } from "zod";

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["mpesa", "stripe", "cash_on_delivery"]),

  shippingName: z.string().trim().min(2, "Full name is required"),

  shippingPhone: z.string().trim().min(10, "Enter a valid phone number"),

  shippingCounty: z.string().trim().min(2, "County is required"),

  shippingTown: z.string().trim().min(2, "Town is required"),

  shippingAddress: z.string().trim().min(5, "Delivery address is required"),

  deliveryInstructions: z.string().trim().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
