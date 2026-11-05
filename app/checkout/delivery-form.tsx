"use client";

import { useState } from "react";

export type DeliveryDetails = {
  shippingName: string;
  shippingPhone: string;
  shippingCounty: string;
  shippingTown: string;
  shippingAddress: string;
  deliveryInstructions: string;
};

type DeliveryFormProps = {
  onChange: (details: DeliveryDetails) => void;
};

export default function DeliveryForm({ onChange }: DeliveryFormProps) {
  const [details, setDetails] = useState<DeliveryDetails>({
    shippingName: "",
    shippingPhone: "",
    shippingCounty: "",
    shippingTown: "",
    shippingAddress: "",
    deliveryInstructions: "",
  });

  function handleChange(field: keyof DeliveryDetails, value: string) {
    const updatedDetails = {
      ...details,
      [field]: value,
    };

    setDetails(updatedDetails);
    onChange(updatedDetails);
  }

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold">Delivery Information</h2>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="shippingName" className="block font-medium">
            Full Name
          </label>

          <input
            id="shippingName"
            type="text"
            value={details.shippingName}
            onChange={(e) => handleChange("shippingName", e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="shippingPhone" className="block font-medium">
            Phone Number
          </label>

          <input
            id="shippingPhone"
            type="tel"
            value={details.shippingPhone}
            onChange={(e) => handleChange("shippingPhone", e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="e.g. 0712345678"
          />
        </div>

        <div>
          <label htmlFor="shippingCounty" className="block font-medium">
            County
          </label>

          <input
            id="shippingCounty"
            type="text"
            value={details.shippingCounty}
            onChange={(e) => handleChange("shippingCounty", e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Enter your county"
          />
        </div>

        <div>
          <label htmlFor="shippingTown" className="block font-medium">
            Town
          </label>

          <input
            id="shippingTown"
            type="text"
            value={details.shippingTown}
            onChange={(e) => handleChange("shippingTown", e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Enter your town"
          />
        </div>

        <div>
          <label htmlFor="shippingAddress" className="block font-medium">
            Physical Delivery Address
          </label>

          <textarea
            id="shippingAddress"
            value={details.shippingAddress}
            onChange={(e) => handleChange("shippingAddress", e.target.value)}
            required
            rows={3}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Enter your estate, building, street, or other directions"
          />
        </div>

        <div>
          <label htmlFor="deliveryInstructions" className="block font-medium">
            Delivery Instructions (Optional)
          </label>

          <textarea
            id="deliveryInstructions"
            value={details.deliveryInstructions}
            onChange={(e) =>
              handleChange("deliveryInstructions", e.target.value)
            }
            rows={2}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Any additional delivery instructions?"
          />
        </div>
      </div>
    </div>
  );
}
