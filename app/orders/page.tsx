import { auth } from "@/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function OrdersPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    redirect("/login");
  }

  const customerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt));

  const customerOrderItems = await db
    .select()
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orders.userId, session.user.id));

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">My Orders</h1>

      <p className="mt-3 text-gray-600">
        View your previous purchases and order status.
      </p>

      <div className="mt-8 space-y-6">
        {customerOrders.length === 0 ? (
          <p className="text-gray-600">
            You haven&apos;t placed any orders yet.
          </p>
        ) : (
          customerOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                <div>
                  <h2 className="font-bold">Order #{order.id.slice(0, 8)}</h2>

                  <p className="mt-2 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <p className="font-bold">
                    KSh{" "}
                    {Number(order.total).toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>

                  <p className="mt-2 text-sm capitalize">
                    Payment: {order.paymentMethod.replaceAll("_", " ")}
                  </p>

                  <p className="text-sm capitalize">
                    Payment status: {order.paymentStatus}
                  </p>

                  <p className="text-sm capitalize">
                    Order status: {order.status}
                  </p>
                </div>
              </div>

              {/* Items Ordered Section */}
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-3">Items Ordered</h3>

                <div className="space-y-3">
                  {customerOrderItems
                    .filter((item) => item.order_items.orderId === order.id)
                    .map((item) => (
                      <div
                        key={item.order_items.id}
                        className="flex justify-between gap-4 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {item.order_items.productName}
                          </p>

                          <p className="text-gray-500">
                            Quantity: {item.order_items.quantity}
                          </p>
                        </div>

                        <p className="font-semibold">
                          KSh{" "}
                          {(
                            Number(item.order_items.unitPrice) *
                            item.order_items.quantity
                          ).toLocaleString("en-KE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    ))}
                </div>

                {/* Navigation Button placed cleanly at the bottom */}
                <div className="mt-5">
                  <Link
                    href={`/orders/${order.id}`}
                    className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
                  >
                    View Order Details
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
