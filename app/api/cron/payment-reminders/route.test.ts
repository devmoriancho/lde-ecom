import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
  createPaymentReminderEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: mocks.transaction,
    select: mocks.select,
    update: mocks.update,
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/email-templates", () => ({
  createPaymentReminderEmail: mocks.createPaymentReminderEmail,
}));

import { GET } from "./route";

describe("Payment reminders cron GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const request = new Request("http://localhost/api/cron/payment-reminders");

    const response = await GET(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: "CRON_SECRET is not configured.",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects requests without valid authorization", async () => {
    const request = new Request("http://localhost/api/cron/payment-reminders", {
      headers: {
        Authorization: "Bearer wrong-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "Unauthorized.",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("completes successfully when no payment reminders are due", async () => {
    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) => {
        const query = {
          from: vi.fn(),
          where: vi.fn(),
          for: vi.fn().mockResolvedValue([]),
        };

        query.from.mockReturnValue(query);
        query.where.mockReturnValue(query);

        return callback({
          select: vi.fn().mockReturnValue(query),
          update: vi.fn(),
        });
      },
    );

    const request = new Request("http://localhost/api/cron/payment-reminders", {
      headers: {
        Authorization: "Bearer test-cron-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Payment reminder check completed.",
      checked: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    });

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("claims an eligible order and successfully sends a payment reminder", async () => {
    const order = {
      id: "test-order-001",
      userId: "test-user-001",
      total: "150.00",
      shippingName: "Test Customer",
      reservationExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
    };

    const dueOrdersQuery = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn().mockResolvedValue([{ id: order.id, userId: order.userId }]),
    };
    dueOrdersQuery.from.mockReturnValue(dueOrdersQuery);
    dueOrdersQuery.where.mockReturnValue(dueOrdersQuery);

    const claimedOrdersQuery = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn().mockResolvedValue([order]),
    };
    claimedOrdersQuery.set.mockReturnValue(claimedOrdersQuery);
    claimedOrdersQuery.where.mockReturnValue(claimedOrdersQuery);

    const customerEmailsQuery = {
      from: vi.fn(),
      where: vi
        .fn()
        .mockResolvedValue([
          { id: order.userId, email: "customer@example.com" },
        ]),
    };
    customerEmailsQuery.from.mockReturnValue(customerEmailsQuery);

    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(dueOrdersQuery)
        .mockReturnValueOnce(customerEmailsQuery),
      update: vi.fn().mockReturnValue(claimedOrdersQuery),
    };

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) => callback(tx),
    );

    const currentOrderQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([{ id: order.id }]),
    };
    currentOrderQuery.from.mockReturnValue(currentOrderQuery);
    currentOrderQuery.where.mockReturnValue(currentOrderQuery);

    mocks.select.mockReturnValue(currentOrderQuery);

    const dbUpdateQuery = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbUpdateQuery.set.mockReturnValue(dbUpdateQuery);
    mocks.update.mockReturnValue(dbUpdateQuery);

    mocks.createPaymentReminderEmail.mockReturnValue({
      subject: "Payment reminder",
      html: "<p>Please complete your payment.</p>",
      text: "Please complete your payment.",
    });

    mocks.sendEmail.mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/cron/payment-reminders", {
      headers: {
        Authorization: "Bearer test-cron-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Payment reminder check completed.",
      checked: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    });

    expect(claimedOrdersQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentReminderClaimedAt: expect.any(Date),
      }),
    );

    expect(mocks.createPaymentReminderEmail).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "Payment reminder",
      }),
    );

    expect(dbUpdateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentReminderSentAt: expect.any(Date),
        paymentReminderClaimedAt: null,
      }),
    );
  });

  it("releases the claim when payment reminder email delivery fails", async () => {
    const order = {
      id: "test-order-002",
      userId: "test-user-002",
      total: "150.00",
      shippingName: "Test Customer",
      reservationExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
    };

    const dueOrdersQuery = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn().mockResolvedValue([{ id: order.id, userId: order.userId }]),
    };
    dueOrdersQuery.from.mockReturnValue(dueOrdersQuery);
    dueOrdersQuery.where.mockReturnValue(dueOrdersQuery);

    const claimedOrdersQuery = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn().mockResolvedValue([order]),
    };
    claimedOrdersQuery.set.mockReturnValue(claimedOrdersQuery);
    claimedOrdersQuery.where.mockReturnValue(claimedOrdersQuery);

    const customerEmailsQuery = {
      from: vi.fn(),
      where: vi
        .fn()
        .mockResolvedValue([
          { id: order.userId, email: "customer@example.com" },
        ]),
    };
    customerEmailsQuery.from.mockReturnValue(customerEmailsQuery);

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) =>
        callback({
          select: vi
            .fn()
            .mockReturnValueOnce(dueOrdersQuery)
            .mockReturnValueOnce(customerEmailsQuery),
          update: vi.fn().mockReturnValue(claimedOrdersQuery),
        }),
    );

    const currentOrderQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([{ id: order.id }]),
    };
    currentOrderQuery.from.mockReturnValue(currentOrderQuery);
    currentOrderQuery.where.mockReturnValue(currentOrderQuery);
    mocks.select.mockReturnValue(currentOrderQuery);

    const dbUpdateQuery = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbUpdateQuery.set.mockReturnValue(dbUpdateQuery);
    mocks.update.mockReturnValue(dbUpdateQuery);

    mocks.createPaymentReminderEmail.mockReturnValue({
      subject: "Payment reminder",
      html: "<p>Please complete your payment.</p>",
      text: "Please complete your payment.",
    });

    mocks.sendEmail.mockResolvedValue({ success: false });

    const request = new Request("http://localhost/api/cron/payment-reminders", {
      headers: {
        Authorization: "Bearer test-cron-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Payment reminder check completed.",
      checked: 1,
      sent: 0,
      failed: 1,
      skipped: 0,
    });

    expect(mocks.sendEmail).toHaveBeenCalledOnce();

    expect(dbUpdateQuery.set).toHaveBeenCalledWith({
      paymentReminderClaimedAt: null,
    });

    expect(dbUpdateQuery.set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        paymentReminderSentAt: expect.any(Date),
      }),
    );
  });
});
