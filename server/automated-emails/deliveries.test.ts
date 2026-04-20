import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceClientMock = vi.fn();

vi.mock("@/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

interface FakeDeliveryRow {
  id: string;
  user_id: string;
  email_type: string;
  delivery_key: string;
  status: "pending" | "sent" | "failed";
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  updated_at: string;
}

interface FakeDeliveriesState {
  rows: FakeDeliveryRow[];
  insertError: { code?: string; message: string } | null;
  // Each update operation appends to this list with the row id and the
  // payload that landed, so tests can assert ordering and content.
  updateLog: Array<{ id: string; payload: Record<string, unknown> }>;
}

function createState(): FakeDeliveriesState {
  return {
    rows: [],
    insertError: null,
    updateLog: [],
  };
}

function createFakeServiceClient(state: FakeDeliveriesState) {
  return {
    from(table: string) {
      if (table !== "automated_email_deliveries") {
        throw new Error(`Unexpected table in test stub: ${table}`);
      }

      let mode: "select" | "insert" | "update" | null = null;
      let insertPayload: Record<string, unknown> | null = null;
      let updatePayload: Record<string, unknown> | null = null;
      const eqFilters: Record<string, string> = {};

      const builder = {
        select() {
          if (mode === null) {
            mode = "select";
          }
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          mode = "insert";
          insertPayload = payload;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          mode = "update";
          updatePayload = payload;
          return builder;
        },
        eq(column: string, value: string) {
          eqFilters[column] = value;
          return builder;
        },
        maybeSingle() {
          const matchingRow = state.rows.find(
            (row) =>
              row.user_id === eqFilters.user_id &&
              row.email_type === eqFilters.email_type &&
              row.delivery_key === eqFilters.delivery_key,
          );
          return Promise.resolve({
            data: matchingRow ?? null,
            error: null,
          });
        },
        single() {
          if (mode === "insert" && insertPayload) {
            if (state.insertError) {
              return Promise.resolve({
                data: null,
                error: state.insertError,
              });
            }

            const newRow: FakeDeliveryRow = {
              id: `delivery-${state.rows.length + 1}`,
              user_id: insertPayload.user_id as string,
              email_type: insertPayload.email_type as string,
              delivery_key: insertPayload.delivery_key as string,
              status:
                (insertPayload.status as FakeDeliveryRow["status"]) ??
                "pending",
              provider_message_id: null,
              error_message: null,
              sent_at: null,
              updated_at: `2026-04-20T13:00:0${state.rows.length}.000Z`,
            };
            state.rows.push(newRow);
            return Promise.resolve({ data: newRow, error: null });
          }

          return Promise.resolve({
            data: null,
            error: { message: "Unexpected single() call" },
          });
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          if (mode === "update") {
            return Promise.resolve(runUpdate()).then(onFulfilled, onRejected);
          }

          return Promise.resolve(
            onFulfilled({
              data: null,
              error: { message: "Unexpected then() call" },
            }),
          );
        },
      };

      function runUpdate() {
        if (!updatePayload) {
          return { error: { message: "Update payload missing" } };
        }

        const targetRow = state.rows.find(
          (row) =>
            row.id === eqFilters.id &&
            (!eqFilters.status || row.status === eqFilters.status) &&
            (!eqFilters.updated_at || row.updated_at === eqFilters.updated_at),
        );
        if (!targetRow) {
          return { data: [], error: null };
        }

        Object.assign(targetRow, updatePayload);
        targetRow.updated_at = "2026-04-20T13:30:00.000Z";
        state.updateLog.push({
          id: targetRow.id,
          payload: updatePayload,
        });
        return { data: [targetRow], error: null };
      }

      return builder;
    },
  };
}

describe("isAutomatedEmailDeliveryAlreadySent", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("returns true when an existing delivery row is marked as sent", async () => {
    const state = createState();
    state.rows.push({
      id: "delivery-existing",
      user_id: "user-1",
      email_type: "weekly_recap",
      delivery_key: "weekly:2026-04-20",
      status: "sent",
      provider_message_id: "provider-x",
      error_message: null,
      sent_at: "2026-04-20T13:00:00.000Z",
      updated_at: "2026-04-20T13:00:00.000Z",
    });
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const { isAutomatedEmailDeliveryAlreadySent } =
      await import("./deliveries");
    const alreadySent = await isAutomatedEmailDeliveryAlreadySent({
      userId: "user-1",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
    });

    expect(alreadySent).toBe(true);
  });

  it("returns false when no matching row exists", async () => {
    createServiceClientMock.mockReturnValue(
      createFakeServiceClient(createState()),
    );

    const { isAutomatedEmailDeliveryAlreadySent } =
      await import("./deliveries");
    const alreadySent = await isAutomatedEmailDeliveryAlreadySent({
      userId: "user-1",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
    });

    expect(alreadySent).toBe(false);
  });

  it("returns false when the matching row is still pending or failed", async () => {
    const state = createState();
    state.rows.push({
      id: "delivery-pending",
      user_id: "user-1",
      email_type: "weekly_recap",
      delivery_key: "weekly:2026-04-20",
      status: "failed",
      provider_message_id: null,
      error_message: "boom",
      sent_at: null,
      updated_at: "2026-04-20T13:00:00.000Z",
    });
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const { isAutomatedEmailDeliveryAlreadySent } =
      await import("./deliveries");
    const alreadySent = await isAutomatedEmailDeliveryAlreadySent({
      userId: "user-1",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
    });

    expect(alreadySent).toBe(false);
  });
});

describe("sendAutomatedEmail", () => {
  beforeEach(() => {
    createServiceClientMock.mockReset();
  });

  it("returns already_sent without invoking the sender when the delivery row is sent", async () => {
    const state = createState();
    state.rows.push({
      id: "delivery-existing",
      user_id: "user-1",
      email_type: "weekly_recap",
      delivery_key: "weekly:2026-04-20",
      status: "sent",
      provider_message_id: "provider-existing",
      error_message: null,
      sent_at: "2026-04-20T13:00:00.000Z",
      updated_at: "2026-04-20T13:00:00.000Z",
    });
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const sendEmail = vi.fn();
    const { sendAutomatedEmail } = await import("./deliveries");
    const result = await sendAutomatedEmail({
      userId: "user-1",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
      sender: { sendEmail },
      message: {
        from: "from@test",
        to: "to@test",
        subject: "subject",
        html: "<p>html</p>",
      },
    });

    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: "already_sent",
      deliveryRecordId: "delivery-existing",
      providerMessageId: "provider-existing",
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.updateLog).toEqual([]);
  });

  it("creates a pending row, calls the sender, and marks the delivery as sent on success", async () => {
    const state = createState();
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "resend",
      messageId: "provider-new",
    });

    const { sendAutomatedEmail } = await import("./deliveries");
    const result = await sendAutomatedEmail({
      userId: "user-1",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
      sender: { sendEmail },
      message: {
        from: "from@test",
        to: "to@test",
        subject: "Hello",
        html: "<p>Hi</p>",
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      user_id: "user-1",
      email_type: "weekly_recap",
      delivery_key: "weekly:2026-04-20",
      status: "sent",
      provider_message_id: "provider-new",
    });
    expect(result).toEqual({
      success: true,
      skipped: false,
      deliveryRecordId: state.rows[0].id,
      providerMessageId: "provider-new",
    });
  });

  it("marks the delivery as failed and returns the error message when the sender throws a non-transient error", async () => {
    const state = createState();
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const sendEmail = vi
      .fn()
      .mockRejectedValue(new Error("Permanent provider rejection"));

    const { sendAutomatedEmail } = await import("./deliveries");
    const result = await sendAutomatedEmail({
      userId: "user-2",
      emailType: "reengagement",
      deliveryKey: "reengagement:2026-04-20",
      sender: { sendEmail },
      message: {
        from: "from@test",
        to: "to@test",
        subject: "Hi",
        html: "<p>Hi</p>",
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected failure result");
    }
    expect(result.errorMessage).toBe("Permanent provider rejection");

    const failedRow = state.rows.at(-1);
    expect(failedRow).toMatchObject({
      status: "failed",
      error_message: "Permanent provider rejection",
      provider_message_id: null,
      sent_at: null,
    });
  });

  it("treats a unique-key race on a pending row as in flight and does not send twice", async () => {
    const state = createState();
    // Pre-seed the row another worker would have just created.
    state.rows.push({
      id: "delivery-race",
      user_id: "user-3",
      email_type: "weekly_recap",
      delivery_key: "weekly:2026-04-20",
      status: "pending",
      provider_message_id: null,
      error_message: null,
      sent_at: null,
      updated_at: "2026-04-20T13:00:00.000Z",
    });
    state.insertError = { code: "23505", message: "duplicate key" };
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "resend",
      messageId: "provider-after-race",
    });

    const { sendAutomatedEmail } = await import("./deliveries");
    const result = await sendAutomatedEmail({
      userId: "user-3",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
      sender: { sendEmail },
      message: {
        from: "from@test",
        to: "to@test",
        subject: "Hi",
        html: "<p>Hi</p>",
      },
    });

    // Another worker created the pending row first, so this worker must treat
    // it as in-flight and avoid a duplicate provider send.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      id: "delivery-race",
      status: "pending",
      provider_message_id: null,
    });
    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: "in_flight",
      deliveryRecordId: "delivery-race",
      providerMessageId: null,
    });
  });

  it("reclaims a stale pending row before retrying the provider send", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T13:30:00.000Z"));

    const state = createState();
    state.rows.push({
      id: "delivery-stale",
      user_id: "user-4",
      email_type: "weekly_recap",
      delivery_key: "weekly:2026-04-20",
      status: "pending",
      provider_message_id: null,
      error_message: null,
      sent_at: null,
      updated_at: "2026-04-20T13:00:00.000Z",
    });
    createServiceClientMock.mockReturnValue(createFakeServiceClient(state));

    const sendEmail = vi.fn().mockResolvedValue({
      provider: "resend",
      messageId: "provider-reclaimed",
    });

    const { sendAutomatedEmail } = await import("./deliveries");
    const result = await sendAutomatedEmail({
      userId: "user-4",
      emailType: "weekly_recap",
      deliveryKey: "weekly:2026-04-20",
      sender: { sendEmail },
      message: {
        from: "from@test",
        to: "to@test",
        subject: "Hi",
        html: "<p>Hi</p>",
      },
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(state.rows[0]).toMatchObject({
      id: "delivery-stale",
      status: "sent",
      provider_message_id: "provider-reclaimed",
    });
    expect(result).toEqual({
      success: true,
      skipped: false,
      deliveryRecordId: "delivery-stale",
      providerMessageId: "provider-reclaimed",
    });
  });
});
