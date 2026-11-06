import { auth } from "@/auth";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

type AdminOrdersPageProps = {
  searchParams: Promise<{
    status?: string;
    paymentStatus?: string;
  }>;
};

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/login");
  }

  const filters = await searchParams;

  const validOrderStatuses = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ] as const;

  const validPaymentStatuses = [
    "pending",
    "paid",
    "failed",
    "refunded",
  ] as const;

  const statusFilter = validOrderStatuses.includes(
    filters.status as (typeof validOrderStatuses)[number],
  )
    ? (filters.status as (typeof validOrderStatuses)[number])
    : undefined;

  const paymentStatusFilter = validPaymentStatuses.includes(
    filters.paymentStatus as (typeof validPaymentStatuses)[number],
  )
    ? (filters.paymentStatus as (typeof validPaymentStatuses)[number])
    : undefined;

  const allOrders = await db
    .select({
      id: orders.id,
      customerName: users.name,
      total: orders.total,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(
      and(
        statusFilter ? eq(orders.status, statusFilter) : undefined,
        paymentStatusFilter
          ? eq(orders.paymentStatus, paymentStatusFilter)
          : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt));

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Admin Order Management</h1>

      <form
        method="GET"
        className="mb-6 grid gap-4 rounded-lg border p-5 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="status" className="mb-2 block font-medium">
            Filter by Order Status
          </label>

          <select
            id="status"
            name="status"
            defaultValue={statusFilter ?? ""}
            className="w-full rounded-lg border p-3"
          >
            <option value="">All Order Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label htmlFor="paymentStatus" className="mb-2 block font-medium">
            Filter by Payment Status
          </label>

          <select
            id="paymentStatus"
            name="paymentStatus"
            defaultValue={paymentStatusFilter ?? ""}
            className="w-full rounded-lg border p-3"
          >
            <option value="">All Payment Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>

          <a
            href="/admin/orders"
            className="rounded-lg border px-5 py-2.5 font-semibold"
          >
            Clear Filters
          </a>
        </div>
      </form>

      {allOrders.length === 0 ? (
        <p>No customer orders found.</p>
      ) : (
        <div className="space-y-4">
          {allOrders.map((order) => (
            <div key={order.id} className="rounded-lg border p-5 shadow-sm">
              <h2 className="font-semibold">Order #{order.id.slice(0, 8)}</h2>

              <p>Customer: {order.customerName}</p>

              <p>
                Total: KSh{" "}
                {Number(order.total).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>

              <p className="capitalize">
                Payment Method: {order.paymentMethod.replaceAll("_", " ")}
              </p>

              <p className="capitalize">
                Payment Status: {order.paymentStatus}
              </p>

              <p className="capitalize">Order Status: {order.status}</p>

              <p>Date: {order.createdAt.toLocaleDateString("en-KE")}</p>
              <div className="mt-4">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
                >
                  View Order Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
