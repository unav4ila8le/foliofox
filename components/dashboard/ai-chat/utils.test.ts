import { afterEach, describe, expect, it, vi } from "vitest";

import { generateUuid } from "./utils";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateUuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });

    expect(generateUuid()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("falls back to getRandomValues in insecure contexts", () => {
    // Simulate a plain-HTTP LAN-IP context: randomUUID missing,
    // getRandomValues still available.
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(
        globalThis.crypto,
      ),
    });

    expect(generateUuid()).toMatch(UUID_V4_PATTERN);
    expect(generateUuid()).not.toBe(generateUuid());
  });
});
