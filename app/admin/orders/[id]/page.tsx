import { auth } from "@/auth";
import { db } from "@/lib/db";
import { orders, orderItems, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import OrderStatusForm from "./order-status-form";
import PaymentStatusForm from "./payment-status-form";

type AdminOrderDetailsProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminOrderDetailsPage({
  params,
}: AdminOrderDetailsProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/login");
  }

  const { id } = await params;

  const [order] = await db
    .select({
      id: orders.id,
      total: orders.total,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
      shippingName: orders.shippingName,
      shippingPhone: orders.shippingPhone,
      shippingCounty: orders.shippingCounty,
      shippingTown: orders.shippingTown,
      shippingAddress: orders.shippingAddress,
      deliveryInstructions: orders.deliveryInstructions,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    notFound();
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold">Order Details</h1>
        <p className="mt-2 text-gray-600">Order #{order.id}</p>
      </div>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-xl font-semibold">Customer Information</h2>

        <p>Name: {order.customerName}</p>
        <p>Email: {order.customerEmail}</p>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-xl font-semibold">Delivery Information</h2>

        <p>Name: {order.shippingName}</p>
        <p>Phone: {order.shippingPhone}</p>
        <p>County: {order.shippingCounty}</p>
        <p>Town: {order.shippingTown}</p>
        <p>Address: {order.shippingAddress}</p>
        <p>Instructions: {order.deliveryInstructions || "None"}</p>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-xl font-semibold">Payment and Order Status</h2>

        <p>Payment Method: {order.paymentMethod}</p>
        <p>Payment Status: {order.paymentStatus}</p>
        <p>Order Status: {order.status}</p>
        <PaymentStatusForm
          orderId={order.id}
          currentStatus={order.paymentStatus}
          paymentMethod={order.paymentMethod}
        />
        <OrderStatusForm orderId={order.id} currentStatus={order.status} />
        <p>
          Total: KSh{" "}
          {Number(order.total).toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p>Date: {order.createdAt.toLocaleDateString("en-KE")}</p>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-xl font-semibold">Purchased Products</h2>

        {items.map((item) => (
          <div key={item.id} className="border-b py-3 last:border-b-0">
            <p className="font-medium">{item.productName}</p>
            <p>Quantity: {item.quantity}</p>
            <p>
              Unit Price: KSh{" "}
              {Number(item.unitPrice).toLocaleString("en-KE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p>
              Subtotal: KSh{" "}
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
      </section>
    </main>
  );
}
