import { createProduct } from "@/app/actions/products";

export default function NewProductPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Add New Product</h1>

      <form action={createProduct} className="space-y-4">
        <div>
          <label>Product Name</label>
          <input
            type="text"
            name="name"
            required
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label>Price</label>
          <input
            type="number"
            name="price"
            step="0.01"
            min="0"
            required
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label>Stock</label>
          <input
            type="number"
            name="stock"
            min="0"
            required
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label>Description</label>
          <textarea name="description" className="border p-2 w-full rounded" />
        </div>

        <div>
          <label>Image URL</label>
          <input
            type="text"
            name="image"
            className="border p-2 w-full rounded"
          />
        </div>

        <button type="submit" className="bg-black text-white px-6 py-2 rounded">
          Add Product
        </button>
      </form>
    </main>
  );
}
