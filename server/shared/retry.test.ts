import { describe, expect, it } from "vitest";

import { isTransientError } from "./retry";

describe("isTransientError", () => {
  it("treats provider rate limits as transient", () => {
    expect(
      isTransientError({ status: 429, message: "Too Many Requests" }),
    ).toBe(true);
    expect(isTransientError("too many requests")).toBe(true);
  });
});
