import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  selectLimit: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  queryMpesaStkPush: vi.fn(),
  sendEmail: vi.fn(),
  createPaymentConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
    update: mocks.update,
  },
}));

vi.mock("@/lib/mpesa", () => ({
  queryMpesaStkPush: mocks.queryMpesaStkPush,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/email-templates", () => ({
  createPaymentConfirmationEmail: mocks.createPaymentConfirmationEmail,
}));

import { POST } from "./route";

describe("M-PESA callback POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectLimit.mockResolvedValue([]);

    mocks.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mocks.selectLimit,
        }),
      }),
    });
  });

  it("rejects an invalid callback payload", async () => {
    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid M-PESA callback payload.",
    });
  });

  it("acknowledges an unsuccessful payment without querying Safaricom", async () => {
    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 1032,
            ResultDesc: "Request cancelled by user",
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Callback received.",
    });

    expect(mocks.queryMpesaStkPush).not.toHaveBeenCalled();
  });

  it("returns 404 when the order does not exist", async () => {
    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Order not found.",
    });

    expect(mocks.queryMpesaStkPush).not.toHaveBeenCalled();
  });

  it("rejects a successful callback when STK Query does not match", async () => {
    mocks.selectLimit.mockResolvedValueOnce([{ id: "test-order-001" }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "DIFFERENT-CHECKOUT-ID",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "M-PESA payment could not be verified.",
    });
  });

  it("rejects a verified callback when payment metadata is missing", async () => {
    mocks.selectLimit.mockResolvedValueOnce([{ id: "test-order-001" }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "TEST-CHECKOUT-001",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "M-PESA payment metadata is missing.",
    });
  });
  it("processes a verified payment, updates the order, and sends confirmation email", async () => {
    const order = {
      id: "test-order-001",
      userId: "test-user-001",
      paymentMethod: "mpesa",
      paymentStatus: "pending",
      status: "pending",
      total: "100.00",
      mpesaCheckoutRequestId: "TEST-CHECKOUT-001",
      mpesaMerchantRequestId: "TEST-MERCHANT-001",
      mpesaPhoneNumber: "254712345678",
      mpesaReceiptNumber: null,
      stockReservationExpiresAt: new Date(),
      stockRestoredAt: null,
      mpesaPaymentEmailSentAt: null,
      mpesaPaymentEmailClaimedAt: null,
      shippingName: "Test Customer",
    };

    const customer = {
      email: "customer@example.com",
      name: "Customer",
    };

    mocks.selectLimit.mockResolvedValueOnce([{ id: order.id }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "TEST-CHECKOUT-001",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const makeSelectQuery = (result: unknown[]) => {
      const query = {
        from: vi.fn(),
        where: vi.fn(),
        for: vi.fn(),
        limit: vi.fn().mockResolvedValue(result),
      };

      query.from.mockReturnValue(query);
      query.where.mockReturnValue(query);
      query.for.mockReturnValue(query);

      return query;
    };

    const txSelect = vi
      .fn()
      .mockReturnValueOnce(makeSelectQuery([order]))
      .mockReturnValueOnce(makeSelectQuery([customer]));

    const updateSets: Record<string, unknown>[] = [];

    const makeUpdateQuery = () => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateSets.push(values);

        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });

    const txUpdate = vi.fn().mockImplementation(makeUpdateQuery);

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: typeof txSelect;
          update: typeof txUpdate;
        }) => Promise<unknown>,
      ) =>
        callback({
          select: txSelect,
          update: txUpdate,
        }),
    );

    mocks.update.mockImplementation(makeUpdateQuery);

    mocks.createPaymentConfirmationEmail.mockReturnValue({
      subject: "Payment confirmed",
      html: "<p>Payment confirmed</p>",
      text: "Payment confirmed",
    });

    mocks.sendEmail.mockResolvedValue({
      success: true,
    });

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 100 },
                { Name: "MpesaReceiptNumber", Value: "QAB123XYZ" },
                { Name: "PhoneNumber", Value: 254712345678 },
              ],
            },
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Accepted.",
    });

    expect(mocks.queryMpesaStkPush).toHaveBeenCalledWith("TEST-CHECKOUT-001");

    expect(updateSets[0]).toMatchObject({
      paymentStatus: "paid",
      mpesaReceiptNumber: "QAB123XYZ",
      stockReservationExpiresAt: null,
    });

    expect(mocks.createPaymentConfirmationEmail).toHaveBeenCalledWith({
      customerName: "Test Customer",
      orderId: "test-order-001",
      total: "100.00",
      paymentMethod: "mpesa",
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "Payment confirmed",
      }),
    );

    expect(mocks.update).toHaveBeenCalledOnce();
    expect(updateSets[2]).toEqual({
      mpesaPaymentEmailSentAt: expect.any(Date),
      mpesaPaymentEmailClaimedAt: null,
    });
  });

  it("does not mark an order paid when the callback amount does not match", async () => {
    const order = {
      id: "test-order-001",
      paymentMethod: "mpesa",
      paymentStatus: "pending",
      total: "100.00",
      mpesaCheckoutRequestId: "TEST-CHECKOUT-001",
      mpesaMerchantRequestId: "TEST-MERCHANT-001",
      mpesaPhoneNumber: "254712345678",
      mpesaReceiptNumber: null,
      stockRestoredAt: null,
      status: "pending",
      mpesaPaymentEmailSentAt: null,
      mpesaPaymentEmailClaimedAt: null,
    };

    mocks.selectLimit.mockResolvedValueOnce([{ id: order.id }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "TEST-CHECKOUT-001",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const query = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn(),
      limit: vi.fn().mockResolvedValue([order]),
    };

    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.for.mockReturnValue(query);

    const txUpdate = vi.fn();

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) =>
        callback({
          select: vi.fn().mockReturnValue(query),
          update: txUpdate,
        }),
    );

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 90 },
                { Name: "MpesaReceiptNumber", Value: "QAB123XYZ" },
                { Name: "PhoneNumber", Value: 254712345678 },
              ],
            },
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Callback received.",
    });

    expect(txUpdate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does not send another confirmation email for an already-notified order", async () => {
    const order = {
      id: "test-order-001",
      paymentMethod: "mpesa",
      paymentStatus: "paid",
      total: "100.00",
      mpesaCheckoutRequestId: "TEST-CHECKOUT-001",
      mpesaMerchantRequestId: "TEST-MERCHANT-001",
      mpesaPhoneNumber: "254712345678",
      mpesaReceiptNumber: "QAB123XYZ",
      stockRestoredAt: null,
      status: "pending",
      mpesaPaymentEmailSentAt: new Date(),
      mpesaPaymentEmailClaimedAt: null,
    };

    mocks.selectLimit.mockResolvedValueOnce([{ id: order.id }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "TEST-CHECKOUT-001",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const query = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn(),
      limit: vi.fn().mockResolvedValue([order]),
    };

    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.for.mockReturnValue(query);

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) =>
        callback({
          select: vi.fn().mockReturnValue(query),
          update: vi.fn(),
        }),
    );

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 100 },
                { Name: "MpesaReceiptNumber", Value: "QAB123XYZ" },
                { Name: "PhoneNumber", Value: 254712345678 },
              ],
            },
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Callback received.",
    });

    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.createPaymentConfirmationEmail).not.toHaveBeenCalled();
  });

  it("does not mark an order paid when the callback phone number does not match", async () => {
    const order = {
      id: "test-order-001",
      paymentMethod: "mpesa",
      paymentStatus: "pending",
      total: "100.00",
      mpesaCheckoutRequestId: "TEST-CHECKOUT-001",
      mpesaMerchantRequestId: "TEST-MERCHANT-001",
      mpesaPhoneNumber: "254712345678",
      mpesaReceiptNumber: null,
      stockRestoredAt: null,
      status: "pending",
      mpesaPaymentEmailSentAt: null,
      mpesaPaymentEmailClaimedAt: null,
    };

    mocks.selectLimit.mockResolvedValueOnce([{ id: order.id }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "TEST-CHECKOUT-001",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const query = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn(),
      limit: vi.fn().mockResolvedValue([order]),
    };

    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.for.mockReturnValue(query);

    const txUpdate = vi.fn();

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) =>
        callback({
          select: vi.fn().mockReturnValue(query),
          update: txUpdate,
        }),
    );

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 100 },
                { Name: "MpesaReceiptNumber", Value: "QAB123XYZ" },
                { Name: "PhoneNumber", Value: 254700000000 },
              ],
            },
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Callback received.",
    });

    expect(txUpdate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does not mark an order paid when the merchant request ID does not match", async () => {
    const order = {
      id: "test-order-001",
      paymentMethod: "mpesa",
      paymentStatus: "pending",
      total: "100.00",
      mpesaCheckoutRequestId: "TEST-CHECKOUT-001",
      mpesaMerchantRequestId: "STORED-MERCHANT-001",
      mpesaPhoneNumber: "254712345678",
      mpesaReceiptNumber: null,
      stockRestoredAt: null,
      status: "pending",
      mpesaPaymentEmailSentAt: null,
      mpesaPaymentEmailClaimedAt: null,
    };

    mocks.selectLimit.mockResolvedValueOnce([{ id: order.id }]);

    mocks.queryMpesaStkPush.mockResolvedValue({
      ResultCode: "0",
      CheckoutRequestID: "TEST-CHECKOUT-001",
      MerchantRequestID: "TEST-MERCHANT-001",
    });

    const query = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn(),
      limit: vi.fn().mockResolvedValue([order]),
    };

    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.for.mockReturnValue(query);

    const txUpdate = vi.fn();

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) =>
        callback({
          select: vi.fn().mockReturnValue(query),
          update: txUpdate,
        }),
    );

    const request = new Request("http://localhost/api/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 100 },
                { Name: "MpesaReceiptNumber", Value: "QAB123XYZ" },
                { Name: "PhoneNumber", Value: 254712345678 },
              ],
            },
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Callback received.",
    });

    expect(txUpdate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
