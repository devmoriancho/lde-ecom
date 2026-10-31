import { createProduct } from "@/app/actions/products";

export default async function TestProductsPage() {
  const result = await createProduct();

  return (
    <main>
      <h1>Product inserted successfully!</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
