import { afterEach, describe, expect, it, vi } from "vitest";
import { initiateMpesaStkPush, normalizeMpesaPhoneNumber } from "./mpesa";

describe("normalizeMpesaPhoneNumber", () => {
  it("converts a 07 number to international format", () => {
    expect(normalizeMpesaPhoneNumber("0712345678")).toBe("254712345678");
  });

  it("converts a 01 number to international format", () => {
    expect(normalizeMpesaPhoneNumber("0112345678")).toBe("254112345678");
  });

  it("accepts a number beginning with +254", () => {
    expect(normalizeMpesaPhoneNumber("+254712345678")).toBe("254712345678");
  });

  it("removes spaces and hyphens", () => {
    expect(normalizeMpesaPhoneNumber("0712-345 678")).toBe("254712345678");
  });

  it("rejects an invalid phone number", () => {
    expect(() => normalizeMpesaPhoneNumber("12345")).toThrow(
      "Enter a valid Kenyan M-PESA number",
    );
  });
});

describe("initiateMpesaStkPush validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const validInput = {
    phoneNumber: "254712345678",
    amount: 100,
    accountReference: "TEST-ORDER",
    transactionDesc: "Test payment",
    callbackUrl: "https://example.com/api/mpesa/callback",
  };

  it("rejects a fractional amount", async () => {
    vi.stubEnv("MPESA_SHORTCODE", "174379");

    await expect(
      initiateMpesaStkPush({ ...validInput, amount: 100.5 }),
    ).rejects.toThrow("M-PESA amount must be a positive whole number.");
  });

  it("rejects a zero amount", async () => {
    vi.stubEnv("MPESA_SHORTCODE", "174379");

    await expect(
      initiateMpesaStkPush({ ...validInput, amount: 0 }),
    ).rejects.toThrow("M-PESA amount must be a positive whole number.");
  });

  it("rejects an invalid phone number", async () => {
    vi.stubEnv("MPESA_SHORTCODE", "174379");

    await expect(
      initiateMpesaStkPush({ ...validInput, phoneNumber: "0712345678" }),
    ).rejects.toThrow("Invalid M-PESA phone number.");
  });

  it("rejects a callback URL that does not use HTTPS", async () => {
    vi.stubEnv("MPESA_SHORTCODE", "174379");

    await expect(
      initiateMpesaStkPush({
        ...validInput,
        callbackUrl: "http://example.com/callback",
      }),
    ).rejects.toThrow("M-PESA callback URL must use HTTPS.");
  });
});

describe("initiateMpesaStkPush successful request", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the correct STK Push request to the sandbox", async () => {
    vi.stubEnv("MPESA_CONSUMER_KEY", "test-consumer-key");
    vi.stubEnv("MPESA_CONSUMER_SECRET", "test-consumer-secret");
    vi.stubEnv("MPESA_SHORTCODE", "174379");
    vi.stubEnv("MPESA_PASSKEY", "test-passkey");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-access-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ResponseCode: "0",
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            CustomerMessage: "Success. Request accepted for processing.",
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await initiateMpesaStkPush({
      phoneNumber: "254712345678",
      amount: 100,
      accountReference: "TEST-ORDER",
      transactionDesc: "Test payment",
      callbackUrl: "https://example.com/api/mpesa/callback",
    });

    expect(result.ResponseCode).toBe("0");
    expect(result.CheckoutRequestID).toBe("TEST-CHECKOUT-001");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const stkRequest = fetchMock.mock.calls[1];
    expect(stkRequest[0]).toBe(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    );

    const payload = JSON.parse(stkRequest[1].body);

    expect(payload.Amount).toBe(100);
    expect(payload.PhoneNumber).toBe("254712345678");
    expect(payload.BusinessShortCode).toBe("174379");
    expect(payload.CallBackURL).toBe("https://example.com/api/mpesa/callback");
  });
});

describe("queryMpesaStkPush", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns the Safaricom transaction query result", async () => {
    vi.stubEnv("MPESA_CONSUMER_KEY", "test-consumer-key");
    vi.stubEnv("MPESA_CONSUMER_SECRET", "test-consumer-secret");
    vi.stubEnv("MPESA_SHORTCODE", "174379");
    vi.stubEnv("MPESA_PASSKEY", "test-passkey");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-access-token" })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ResponseCode: "0",
            MerchantRequestID: "TEST-MERCHANT-001",
            CheckoutRequestID: "TEST-CHECKOUT-001",
            ResultCode: "0",
            ResultDesc: "The service request is processed successfully",
          }),
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { queryMpesaStkPush } = await import("./mpesa");
    const result = await queryMpesaStkPush("TEST-CHECKOUT-001");

    expect(result.ResponseCode).toBe("0");
    expect(result.ResultCode).toBe("0");
    expect(result.CheckoutRequestID).toBe("TEST-CHECKOUT-001");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
    );
  });

  it("rejects an unsuccessful Safaricom query response", async () => {
    vi.stubEnv("MPESA_CONSUMER_KEY", "test-consumer-key");
    vi.stubEnv("MPESA_CONSUMER_SECRET", "test-consumer-secret");
    vi.stubEnv("MPESA_SHORTCODE", "174379");
    vi.stubEnv("MPESA_PASSKEY", "test-passkey");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-access-token" })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ResponseCode: "1",
            ResponseDescription: "Request failed",
          }),
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { queryMpesaStkPush } = await import("./mpesa");

    await expect(queryMpesaStkPush("TEST-CHECKOUT-001")).rejects.toThrow(
      "Request failed",
    );
  });
});
