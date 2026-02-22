import { describe, expect, it } from "vitest";

import {
  AI_CHAT_ROUTE,
  buildAIChatExpandHref,
  sanitizeDashboardReturnPath,
} from "@/components/dashboard/ai-chat/navigation";

describe("ai-chat navigation helpers", () => {
  it("builds an expand href with conversation and return path", () => {
    const href = buildAIChatExpandHref({
      conversationId: "conversation-1",
      from: "/dashboard/assets?filter=equity",
    });

    expect(href).toBe(
      `${AI_CHAT_ROUTE}?conversationId=conversation-1&from=%2Fdashboard%2Fassets%3Ffilter%3Dequity`,
    );
  });

  it("accepts valid non-ai dashboard return paths", () => {
    expect(sanitizeDashboardReturnPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeDashboardReturnPath("/dashboard/assets?page=2")).toBe(
      "/dashboard/assets?page=2",
    );
  });

  it("rejects invalid return paths", () => {
    expect(sanitizeDashboardReturnPath(null)).toBeNull();
    expect(sanitizeDashboardReturnPath("/login")).toBeNull();
    expect(sanitizeDashboardReturnPath("/dashboard/ai-chat")).toBeNull();
    expect(sanitizeDashboardReturnPath("/dashboard/ai-chat?foo=1")).toBeNull();
  });
});
