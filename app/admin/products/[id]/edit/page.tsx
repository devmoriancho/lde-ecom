import { updateProduct } from "@/app/actions/products";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product] = await db.select().from(products).where(eq(products.id, id));

  if (!product) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Edit Product</h1>

      <form action={updateProduct} className="space-y-4">
        <input type="hidden" name="id" value={product.id} />

        <div>
          <label>Product Name</label>
          <input
            type="text"
            name="name"
            defaultValue={product.name}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label>Price</label>
          <input
            type="number"
            name="price"
            step="0.01"
            defaultValue={product.price}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label>Stock</label>
          <input
            type="number"
            name="stock"
            defaultValue={product.stock}
            className="border p-2 w-full rounded"
          />
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
        </div>

        <button type="submit" className="bg-black text-white px-6 py-2 rounded">
          Update Product
        </button>
      </form>
    </main>
  );
}
