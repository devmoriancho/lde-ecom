"use client";

import { useState } from "react";
import { updateOrderStatus } from "../actions";

type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

type OrderStatusFormProps = {
  orderId: string;
  currentStatus: OrderStatus;
};

export default function OrderStatusForm({
  orderId,
  currentStatus,
}: OrderStatusFormProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableStatuses = [
    currentStatus,
    ...allowedTransitions[currentStatus],
  ];

  async function handleSubmit() {
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await updateOrderStatus({
        orderId,
        status,
      });

      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Status update failed:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 space-y-3 border-t pt-5">
      <label htmlFor="order-status" className="block font-semibold">
        Update Order Status
      </label>

      <select
        id="order-status"
        value={status}
        onChange={(event) => setStatus(event.target.value as OrderStatus)}
        disabled={isSubmitting}
        className="w-full rounded-lg border p-3"
      >
        {availableStatuses.map((availableStatus) => (
          <option key={availableStatus} value={availableStatus}>
            {availableStatus.charAt(0).toUpperCase() + availableStatus.slice(1)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || status === currentStatus}
        className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Updating..." : "Save Status"}
      </button>

      {message && (
        <p className="text-sm font-medium" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
