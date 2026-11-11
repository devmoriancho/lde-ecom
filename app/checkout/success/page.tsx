type SuccessPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const { session_id } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-green-700">Checkout Completed</h1>

      <p className="mt-4 text-gray-600">
        Thank you for your order. We are verifying your payment.
      </p>

      {session_id && (
        <p className="mt-4 text-sm text-gray-500">
          Your checkout session has been received.
        </p>
      )}
    </div>
  );
}
