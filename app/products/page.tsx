import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";

export default async function ProductsPage() {
  const allProducts = await db.select().from(products);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Our Products</h1>

      {allProducts.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allProducts.map((product) => (
            <div key={product.id} className="border rounded-lg p-4">
              <h2 className="text-lg font-semibold">{product.name}</h2>

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
