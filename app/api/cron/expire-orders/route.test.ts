import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
  createOrderExpiryEmail: vi.fn(),
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
  createOrderExpiryEmail: mocks.createOrderExpiryEmail,
}));

import { GET } from "./route";

describe("Expire orders cron GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const request = new Request("http://localhost/api/cron/expire-orders");

    const response = await GET(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: "CRON_SECRET is not configured.",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects requests without valid authorization", async () => {
    const request = new Request("http://localhost/api/cron/expire-orders", {
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

  it("completes successfully when there are no expired orders", async () => {
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

    const request = new Request("http://localhost/api/cron/expire-orders", {
      headers: {
        Authorization: "Bearer test-cron-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Order expiry check completed.",
      checked: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    });

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("cancels an expired order, restores stock, and sends an expiry email", async () => {
    const expiredOrder = {
      id: "test-order-001",
      userId: "test-user-001",
      status: "pending",
      total: "100.00",
      shippingName: "Test Customer",
    };

    const dueOrdersQuery = {
      from: vi.fn(),
      where: vi.fn(),
      for: vi.fn().mockResolvedValue([expiredOrder]),
    };
    dueOrdersQuery.from.mockReturnValue(dueOrdersQuery);
    dueOrdersQuery.where.mockReturnValue(dueOrdersQuery);

    const itemsQuery = {
      from: vi.fn(),
      where: vi
        .fn()
        .mockResolvedValue([{ productId: "test-product-001", quantity: 2 }]),
    };
    itemsQuery.from.mockReturnValue(itemsQuery);

    const customerQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([{ email: "customer@example.com" }]),
    };
    customerQuery.from.mockReturnValue(customerQuery);
    customerQuery.where.mockReturnValue(customerQuery);

    const txUpdateQuery = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    txUpdateQuery.set.mockReturnValue(txUpdateQuery);

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          select: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) => {
        const tx = {
          select: vi
            .fn()
            .mockReturnValueOnce(dueOrdersQuery)
            .mockReturnValueOnce(itemsQuery)
            .mockReturnValueOnce(customerQuery),
          update: vi.fn().mockReturnValue(txUpdateQuery),
        };

        return callback(tx);
      },
    );

    const currentOrderQuery = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([{ id: expiredOrder.id }]),
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

    mocks.createOrderExpiryEmail.mockReturnValue({
      subject: "Order expired",
      html: "<p>Order expired</p>",
      text: "Order expired",
    });

    mocks.sendEmail.mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/cron/expire-orders", {
      headers: {
        Authorization: "Bearer test-cron-secret",
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Order expiry check completed.",
      checked: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    });

    expect(txUpdateQuery.set).toHaveBeenCalledTimes(2);
    expect(txUpdateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        stockRestoredAt: expect.any(Date),
        stockReservationExpiresAt: null,
      }),
    );

    expect(txUpdateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        stock: expect.anything(),
      }),
    );

    expect(mocks.createOrderExpiryEmail).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(dbUpdateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        expiryEmailSentAt: expect.any(Date),
        expiryEmailClaimedAt: null,
      }),
    );
  });
});
