"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFromCart } from "./actions";

type RemoveCartItemProps = {
  cartItemId: string;
};

export default function RemoveCartItem({ cartItemId }: RemoveCartItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleRemove() {
    startTransition(async () => {
      try {
        const result = await removeFromCart(cartItemId);

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
      <button
        onClick={handleRemove}
        disabled={isPending}
        className="text-sm font-semibold text-red-600 hover:text-red-800 hover:underline transition-colors disabled:opacity-50"
      >
        {isPending ? "Removing..." : "Remove"}
      </button>

      {message && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          {message}
        </p>
      )}
    </div>
  );
}
