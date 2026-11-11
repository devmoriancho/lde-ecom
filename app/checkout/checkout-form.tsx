"use client";

import { useState } from "react";
import PaymentMethodSelector, {
  type PaymentMethod,
} from "./payment-method-selector";
import DeliveryForm, { type DeliveryDetails } from "./delivery-form";
import { createOrder } from "./actions";

export default function CheckoutForm() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");

  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    shippingName: "",
    shippingPhone: "",
    shippingCounty: "",
    shippingTown: "",
    shippingAddress: "",
    deliveryInstructions: "",
  });

  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCheckout() {
    setMessage("");
    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await createOrder({
        paymentMethod,
        ...deliveryDetails,
      });

      if (!result.success) {
        setMessage(result.message);

        if ("errors" in result && result.errors) {
          setErrors(result.errors);
        }

        return;
      }

      if ("checkoutUrl" in result && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      if ("orderId" in result) {
        setMessage(`Order created successfully! Order ID: ${result.orderId}`);
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PaymentMethodSelector onChange={setPaymentMethod} />
      <DeliveryForm onChange={setDeliveryDetails} />
      <div className="mt-6 rounded-xl bg-gray-50 p-4">
        <h3 className="font-bold">Delivery Details Preview</h3>

        <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-600">
          {JSON.stringify(deliveryDetails, null, 2)}
        </pre>
      </div>

      <div className="mt-6">
        <p className="text-sm text-gray-600 mb-4">
          Selected payment method: {paymentMethod}
        </p>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Processing..." : "Place Order"}
        </button>

        {message && <p className="mt-4 text-sm font-medium">{message}</p>}

        {Object.entries(errors).map(([field, messages]) => (
          <p key={field} className="mt-2 text-sm text-red-600">
            {field}: {messages?.join(", ")}
          </p>
        ))}
      </div>
    </div>
  );
}
