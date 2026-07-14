import { afterEach, describe, expect, it, vi } from "vitest";

describe("time-zone helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("lists and validates zones via Intl.supportedValuesOf when available", async () => {
    const { getSupportedIanaTimeZones, isValidIanaTimeZone } =
      await import("./time-zone");

    expect(getSupportedIanaTimeZones()).toContain("Europe/Rome");
    expect(isValidIanaTimeZone("Europe/Rome")).toBe(true);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
  });

  it("degrades gracefully on runtimes without Intl.supportedValuesOf", async () => {
    // Simulate a pre-2022 browser/WebView: no supportedValuesOf, but
    // Intl.DateTimeFormat still present for the probing fallback.
    vi.stubGlobal("Intl", {
      DateTimeFormat: Intl.DateTimeFormat,
      supportedValuesOf: undefined,
    });
    const { getSupportedIanaTimeZones, isValidIanaTimeZone } =
      await import("./time-zone");

    expect(getSupportedIanaTimeZones()).toEqual([]);
    expect(isValidIanaTimeZone("Europe/Rome")).toBe(true);
    expect(isValidIanaTimeZone("UTC")).toBe(true);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
  });
});
