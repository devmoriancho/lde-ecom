"use client";

import { useState } from "react";
import { updatePaymentStatus } from "../actions";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

type PaymentStatusFormProps = {
  orderId: string;
  currentStatus: PaymentStatus;
  paymentMethod: "stripe" | "mpesa" | "cash_on_delivery";
};

export default function PaymentStatusForm({
  orderId,
  currentStatus,
  paymentMethod,
}: PaymentStatusFormProps) {
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>(currentStatus);

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await updatePaymentStatus({
        orderId,
        paymentStatus,
      });

      setMessage(result.message);

      if (result.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Payment update failed:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (paymentMethod !== "cash_on_delivery") {
    return (
      <div className="mt-5 border-t pt-5">
        <h3 className="font-semibold">Payment Status</h3>
        <p className="mt-2 text-sm text-gray-600">
          Online payment status is managed automatically after verification by
          the payment provider.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3 border-t pt-5">
      <label htmlFor="payment-status" className="block font-semibold">
        Update Payment Status
      </label>

      <select
        id="payment-status"
        value={paymentStatus}
        onChange={(event) =>
          setPaymentStatus(event.target.value as PaymentStatus)
        }
        disabled={isSubmitting}
        className="w-full rounded-lg border p-3"
      >
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="failed">Failed</option>
        <option value="refunded">Refunded</option>
      </select>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || paymentStatus === currentStatus}
        className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Updating..." : "Save Payment Status"}
      </button>

      {message && (
        <p className="text-sm font-medium" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
