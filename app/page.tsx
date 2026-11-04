import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  const allProducts = await db.select().from(products);
  console.log(
    allProducts.map((product) => ({
      name: product.name,
      image: product.image,
    })),
  );

  return (
    <main className="min-h-screen">
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Welcome to Our Store</h1>

        <p className="text-gray-600 mt-2">
          Discover products you&apos;ll love.
        </p>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-6">Our Products</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allProducts.map((product) => (
              <div key={product.id} className="border rounded-xl p-4">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={300}
                    height={300}
                    loading="eager"
                    className="w-full h-48 object-contain"
                  />
                ) : (
                  <p>Image unavailable</p>
                )}

                <h3 className="text-lg font-semibold mt-4">{product.name}</h3>

                <p className="text-gray-700 mt-2">KSh {product.price}</p>

                <p className="text-sm text-gray-500 mt-1">
                  Stock: {product.stock}
                </p>

                <Link
                  href={`/products/${product.id}`}
                  className="block text-center mt-4 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
