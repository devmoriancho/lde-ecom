import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import CheckoutForm from "./checkout-form";

export default async function CheckoutPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    redirect("/login");
  }

  const items = await db
    .select({
      id: cartItems.id,
      name: products.name,
      price: products.price,
      quantity: cartItems.quantity,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, session.user.id));

  if (items.length === 0) {
    redirect("/cart");
  }

  const cartTotal = items.reduce((total, item) => {
    return total + Number(item.price) * item.quantity;
  }, 0);

  return (
    <main className="min-h-screen">
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Checkout</h1>

        <p className="mt-3 text-gray-600">
          Complete your order by selecting your preferred payment method.
        </p>
        <div className="mt-8 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold">Order Summary</h2>

          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-4 border-b pb-4"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    Quantity: {item.quantity}
                  </p>
                </div>

                <p className="font-semibold">
                  KSh {(Number(item.price) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between border-t pt-4">
            <span className="text-lg font-bold">Total</span>

            <span className="text-xl font-bold">
              KSh {cartTotal.toFixed(2)}
            </span>
          </div>
        </div>
        <CheckoutForm />
      </section>
    </main>
  );
}
