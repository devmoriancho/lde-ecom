import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";

type ProductDetailsProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductDetails({ params }: ProductDetailsProps) {
  const { id } = await params;

  const [product] = await db.select().from(products).where(eq(products.id, id));

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Product Image */}
          <div className="bg-gray-50 rounded-xl p-6">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                width={600}
                height={600}
                className="w-full h-96 object-contain"
                priority
              />
            ) : (
              <p>Image unavailable</p>
            )}
          </div>

          {/* Product Information */}
          <div>
            <h1 className="text-3xl font-bold">{product.name}</h1>

            <p className="text-2xl font-semibold mt-4">KSh {product.price}</p>

            <p className="mt-4 text-gray-600">
              {product.description || "No description available."}
            </p>

            <p className="mt-6">Stock: {product.stock}</p>

            <p className="mt-2">
              {product.stock > 0 ? "Available" : "Out of stock"}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
