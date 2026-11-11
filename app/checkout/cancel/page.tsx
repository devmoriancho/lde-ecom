type CancelPageProps = {
  searchParams: Promise<{
    order_id?: string;
  }>;
};

export default async function CheckoutCancelPage({
  searchParams,
}: CancelPageProps) {
  const { order_id } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-red-600">Payment Not Completed</h1>

      <p className="mt-4 text-gray-600">
        Your payment was not completed. Your order is still pending.
      </p>

      <p className="mt-2 text-sm text-gray-500">
        You can return to checkout and try again. Unpaid orders will expire
        automatically when their reservation time ends.
      </p>

      {order_id && (
        <p className="mt-4 text-sm text-gray-500">
          Order reference: {order_id}
        </p>
      )}

      <a
        href="/checkout"
        className="mt-8 inline-block rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
      >
        Return to Checkout
      </a>
    </div>
  );
}
