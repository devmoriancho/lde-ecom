"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCartQuantity } from "./actions";

type QuantityControlsProps = {
  cartItemId: string;
  quantity: number;
  stock: number;
};

export default function QuantityControls({
  cartItemId,
  quantity,
  stock,
}: QuantityControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function changeQuantity(newQuantity: number) {
    startTransition(async () => {
      try {
        const result = await updateCartQuantity(cartItemId, newQuantity);

        setMessage(result.message);

        if (result.success) {
          router.refresh();
        }
      } catch {
        setMessage("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => changeQuantity(quantity - 1)}
          disabled={isPending || quantity <= 1}
          className="w-10 h-10 border border-gray-300 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          −
        </button>

        <span className="min-w-8 text-center font-bold text-gray-900">
          {quantity}
        </span>

        <button
          onClick={() => changeQuantity(quantity + 1)}
          disabled={isPending || quantity >= stock}
          className="w-10 h-10 border border-gray-300 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      {message && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          {message}
        </p>
      )}
    </div>
  );
}
