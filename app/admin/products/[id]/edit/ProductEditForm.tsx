"use client";

import { useActionState } from "react";
import { updateProduct, type ProductFormState } from "@/app/actions/products";

type ProductEditFormProps = {
  product: {
    id: string;
    name: string;
    price: string;
    stock: number;
    description: string | null;
    image: string | null;
  };
};

const initialState: ProductFormState = {
  success: false,
  message: "",
  errors: {},
};

export default function ProductEditForm({ product }: ProductEditFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateProduct,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={product.id} />

      <div>
        <label>Product Name</label>
        <input
          type="text"
          name="name"
          defaultValue={product.name}
          required
          className="border p-2 w-full rounded"
        />
        {state.errors.name?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label>Price</label>
        <input
          type="number"
          name="price"
          step="0.01"
          min="0"
          defaultValue={product.price}
          required
          className="border p-2 w-full rounded"
        />
        {state.errors.price?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.price[0]}</p>
        )}
      </div>

      <div>
        <label>Stock</label>
        <input
          type="number"
          name="stock"
          min="0"
          defaultValue={product.stock}
          required
          className="border p-2 w-full rounded"
        />
        {state.errors.stock?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.stock[0]}</p>
        )}
      </div>

      <div>
        <label>Description</label>
        <textarea
          name="description"
          defaultValue={product.description ?? ""}
          className="border p-2 w-full rounded"
        />
      </div>

      <div>
        <label>Image URL</label>
        <input
          type="text"
          name="image"
          defaultValue={product.image ?? ""}
          className="border p-2 w-full rounded"
        />
        {state.errors.image?.[0] && (
          <p className="text-red-600 text-sm">{state.errors.image[0]}</p>
        )}
      </div>

      {state.message && (
        <p className={state.success ? "text-green-600" : "text-red-600"}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isPending ? "Updating..." : "Update Product"}
      </button>
    </form>
  );
}
