"use client";

import { useActionState } from "react";
import { deleteProduct, type DeleteProductState } from "@/app/actions/products";

const initialState: DeleteProductState = {
  success: false,
  message: "",
};

export default function DeleteProductButton({
  productId,
}: {
  productId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteProduct,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Are you sure you want to delete this product?",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="productId" value={productId} />

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete Product"}
      </button>

      {state.message && (
        <p
          className={
            state.success
              ? "text-green-600 text-sm mt-2"
              : "text-red-600 text-sm mt-2"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
