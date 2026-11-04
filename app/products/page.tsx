import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import Image from "next/image";
import Link from "next/link";
import { count, desc } from "drizzle-orm";

type ProductsPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

const PRODUCTS_PER_PAGE = 10;

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const { page } = await searchParams;

  const requestedPage = Number(page);

  const currentPage =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [totalResult] = await db.select({ total: count() }).from(products);

  const totalProducts = totalResult.total;

  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);

  const safePage = Math.min(currentPage, Math.max(totalPages, 1));

  const offset = (safePage - 1) * PRODUCTS_PER_PAGE;

  const allProducts = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(PRODUCTS_PER_PAGE)
    .offset(offset);

  return (
    <main className="min-h-screen">
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Our Products</h1>

        <p className="text-gray-600 mt-2">Browse our available products.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {allProducts.map((product) => (
            <div key={product.id} className="border rounded-xl p-4">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  width={400}
                  height={400}
                  className="w-full h-64 object-contain"
                />
              ) : (
                <p>Image unavailable</p>
              )}

              <h2 className="text-xl font-semibold mt-4">{product.name}</h2>

              <p className="mt-2">KSh {product.price}</p>

              <p className="text-gray-600 mt-1">Stock: {product.stock}</p>

              <Link
                href={`/products/${product.id}`}
                className="block text-center mt-4 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>

        {allProducts.length === 0 && (
          <p className="text-gray-600 mt-8">No products available yet.</p>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-10">
            {safePage > 1 ? (
              <Link
                href={`/products?page=${safePage - 1}`}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Previous
              </Link>
            ) : (
              <span className="px-4 py-2 border rounded-lg text-gray-400">
                Previous
              </span>
            )}

            <span className="text-sm font-medium">
              Page {safePage} of {totalPages}
            </span>

            {safePage < totalPages ? (
              <Link
                href={`/products?page=${safePage + 1}`}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Next
              </Link>
            ) : (
              <span className="px-4 py-2 border rounded-lg text-gray-400">
                Next
              </span>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
