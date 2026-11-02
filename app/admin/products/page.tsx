import Link from "next/link";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export default async function AdminProductsPage() {
  const allProducts = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt));

  return (
    <main className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Products</h1>

        <Link
          href="/admin/products/new"
          className="bg-black text-white px-4 py-2 rounded"
        >
          Add Product
        </Link>
      </div>

      {allProducts.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allProducts.map((product) => (
            <div key={product.id} className="border rounded-lg p-4">
              <h2 className="font-semibold text-lg">{product.name}</h2>

              <p>Price: ${product.price}</p>
              <p>Stock: {product.stock}</p>
              <p>{product.description}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
