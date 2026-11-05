"use client";

import { useState, useTransition } from "react";
import { addToCart } from "../actions";

type AddToCartButtonProps = {
  productId: string;
  disabled?: boolean;
};

export default function AddToCartButton({
  productId,
  disabled = false,
}: AddToCartButtonProps) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAddToCart() {
    startTransition(async () => {
      try {
        const result = await addToCart(productId);
        setMessage(result.message);
      } catch {
        setMessage("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleAddToCart}
        disabled={disabled || isPending}
        className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isPending ? "Adding..." : "Add to Cart"}
      </button>

      {message && (
        <p role="status" className="mt-3 text-sm text-gray-600">
          {message}
        </p>
      )}
    </div>
  );
}
