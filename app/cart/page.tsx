import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Image from "next/image";
import QuantityControls from "./quantity-controls";
import RemoveCartItem from "./remove-cart-item";
import Link from "next/link";

export default async function CartPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    redirect("/login");
  }

  const items = await db
    .select({
      id: cartItems.id,
      name: products.name,
      price: products.price,
      image: products.image,
      quantity: cartItems.quantity,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, session.user.id));
  const cartTotal = items.reduce((total, item) => {
    return total + Number(item.price) * item.quantity;
  }, 0);

  return (
    <main className="min-h-screen">
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Your cart is empty
            </h2>

            <p className="mt-3 text-gray-500">
              You haven&apos;t added any products to your cart yet.
            </p>

            <Link
              href="/products"
              className="inline-block mt-6 rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row gap-6 border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow bg-white"
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={160}
                      height={160}
                      className="w-40 h-40 object-contain rounded-xl bg-gray-50 p-3"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 flex items-center justify-center">
                      No image
                    </div>
                  )}

                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {item.name}
                    </h2>

                    <p className="mt-2">Price: KSh {item.price}</p>

                    <QuantityControls
                      cartItemId={item.id}
                      quantity={item.quantity}
                      stock={item.stock}
                    />

                    <RemoveCartItem cartItemId={item.id} />
                  </div>
                </div>
              ))}
            </div>

            <aside className="border rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>KSh {cartTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>

                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total</span>

                  <span className="text-2xl font-bold text-gray-900">
                    KSh {cartTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="mt-6 block w-full rounded-xl bg-gray-900 px-5 py-3 text-center font-semibold text-white hover:bg-gray-700 transition-colors"
              >
                Proceed to Checkout
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
