"use client";

import { useState } from "react";

export type PaymentMethod = "mpesa" | "stripe" | "cash_on_delivery";

type PaymentMethodSelectorProps = {
  onChange: (method: PaymentMethod) => void;
};

export default function PaymentMethodSelector({
  onChange,
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("mpesa");

  function handleChange(method: PaymentMethod) {
    setSelectedMethod(method);
    onChange(method);
  }

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold">Payment Method</h2>

      <div className="mt-5 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name="paymentMethod"
            value="mpesa"
            checked={selectedMethod === "mpesa"}
            onChange={() => handleChange("mpesa")}
          />
          <span>M-PESA</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name="paymentMethod"
            value="stripe"
            checked={selectedMethod === "stripe"}
            onChange={() => handleChange("stripe")}
          />
          <span>Stripe (Card Payment)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name="paymentMethod"
            value="cash_on_delivery"
            checked={selectedMethod === "cash_on_delivery"}
            onChange={() => handleChange("cash_on_delivery")}
          />
          <span>Cash on Delivery</span>
        </label>
      </div>
    </div>
  );
}
