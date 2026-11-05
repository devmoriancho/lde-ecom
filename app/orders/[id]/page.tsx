import { auth } from "@/auth";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";

type OrderDetailsProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailsPage({ params }: OrderDetailsProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "customer") {
    redirect("/login");
  }

  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) {
    notFound();
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>

        <p className="mt-3 text-gray-600">Order #{order.id}</p>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Order Information */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Order Information</h2>

            <div className="mt-5 space-y-3 text-sm">
              <p>
                <strong>Order Date:</strong>{" "}
                {new Date(order.createdAt).toLocaleDateString()}
              </p>

              <p>
                <strong>Total:</strong> KSh{" "}
                {Number(order.total).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>

              <p>
                <strong>Payment Method:</strong>{" "}
                {order.paymentMethod.replaceAll("_", " ")}
              </p>

              <p>
                <strong>Payment Status:</strong> {order.paymentStatus}
              </p>

              <p>
                <strong>Order Status:</strong> {order.status}
              </p>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Delivery Information</h2>

            <div className="mt-5 space-y-3 text-sm">
              <p>
                <strong>Name:</strong> {order.shippingName}
              </p>

              <p>
                <strong>Phone:</strong> {order.shippingPhone}
              </p>

              <p>
                <strong>County:</strong> {order.shippingCounty}
              </p>

              <p>
                <strong>Town:</strong> {order.shippingTown}
              </p>

              <p>
                <strong>Address:</strong> {order.shippingAddress}
              </p>

              {order.deliveryInstructions && (
                <p>
                  <strong>Instructions:</strong> {order.deliveryInstructions}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Purchased Products */}
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Purchased Products</h2>

          <div className="mt-5 space-y-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-4 border-b pb-4 last:border-b-0"
              >
                <div>
                  <p className="font-semibold">{item.productName}</p>

                  <p className="mt-2 text-sm text-gray-500">
                    Quantity: {item.quantity}
                  </p>

                  <p className="text-sm text-gray-500">
                    Unit Price: KSh{" "}
                    {Number(item.unitPrice).toLocaleString("en-KE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <p className="font-bold">
                  KSh{" "}
                  {(Number(item.unitPrice) * item.quantity).toLocaleString(
                    "en-KE",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
