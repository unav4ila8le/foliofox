import { describe, expect, it } from "vitest";

import {
  resolveEffectiveDateKey,
  resolveFetchExchangeRatesOptions,
} from "@/server/exchange-rates/fetch";

describe("resolveFetchExchangeRatesOptions", () => {
  it("uses deterministic defaults", () => {
    expect(resolveFetchExchangeRatesOptions()).toEqual({
      upsert: true,
      staleGuardDays: 7,
      cronCutoffHourUtc: 22,
    });
  });

  it("clamps stale guard and cutoff hour", () => {
    expect(
      resolveFetchExchangeRatesOptions({
        staleGuardDays: -5,
        cronCutoffHourUtc: 42,
      }),
    ).toEqual({
      upsert: true,
      staleGuardDays: 0,
      cronCutoffHourUtc: 23,
    });

    expect(
      resolveFetchExchangeRatesOptions({
        upsert: false,
        staleGuardDays: 3.9,
        cronCutoffHourUtc: -3,
      }),
    ).toEqual({
      upsert: false,
      staleGuardDays: 3,
      cronCutoffHourUtc: 0,
    });
  });
});

describe("resolveEffectiveDateKey", () => {
  it("keeps non-today requests unchanged", () => {
    expect(
      resolveEffectiveDateKey({
        requestedDateKey: "2026-02-16",
        cronCutoffHourUtc: 22,
        now: new Date("2026-02-17T12:00:00.000Z"),
      }),
    ).toBe("2026-02-16");
  });

  it("uses prior day for today requests before cutoff", () => {
    expect(
      resolveEffectiveDateKey({
        requestedDateKey: "2026-02-17",
        cronCutoffHourUtc: 22,
        now: new Date("2026-02-17T21:59:59.000Z"),
      }),
    ).toBe("2026-02-16");
  });

  it("keeps today for requests at or after cutoff", () => {
    expect(
      resolveEffectiveDateKey({
        requestedDateKey: "2026-02-17",
        cronCutoffHourUtc: 22,
        now: new Date("2026-02-17T22:00:00.000Z"),
      }),
    ).toBe("2026-02-17");
  });

  it("handles year boundary when shifting back one day", () => {
    expect(
      resolveEffectiveDateKey({
        requestedDateKey: "2027-01-01",
        cronCutoffHourUtc: 22,
        now: new Date("2027-01-01T10:00:00.000Z"),
      }),
    ).toBe("2026-12-31");
  });
});
