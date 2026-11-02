"use client";

import { deleteProduct } from "@/app/actions/products";

export default function DeleteProductButton({
  productId,
}: {
  productId: string;
}) {
  return (
    <form
      action={deleteProduct.bind(null, productId)}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Are you sure you want to delete this product?",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
      >
        Delete Product
      </button>
    </form>
  );
}
