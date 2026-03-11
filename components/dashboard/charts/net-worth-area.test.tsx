import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toCivilDateKeyOrThrow } from "@/lib/date/date-utils";

import { NetWorthAreaChart } from "./net-worth-area";

const { fetchPortfolioPerformanceRangeMock } = vi.hoisted(() => ({
  fetchPortfolioPerformanceRangeMock: vi.fn(),
}));

vi.mock("@/server/analysis/performance/fetch-range", () => ({
  fetchPortfolioPerformanceRange: fetchPortfolioPerformanceRangeMock,
}));

vi.mock("@/server/analysis/net-worth/net-worth-history", () => ({
  fetchNetWorthHistory: vi.fn(),
}));

vi.mock("@/server/analysis/net-worth/net-worth-change", () => ({
  fetchNetWorthChange: vi.fn(),
}));

vi.mock(
  "@/components/dashboard/net-worth-mode/net-worth-mode-provider",
  () => ({
    useNetWorthMode: () => ({
      isRefreshing: false,
    }),
  }),
);

vi.mock("@/components/dashboard/providers/privacy-mode-provider", () => ({
  usePrivacyMode: () => ({
    isPrivacyMode: false,
  }),
  PrivacyModeButton: () => <button type="button">privacy</button>,
}));

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => "en-US",
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: () => <div />,
  Area: () => <div data-testid="area-series" />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe("NetWorthAreaChart", () => {
  beforeEach(() => {
    fetchPortfolioPerformanceRangeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not fetch performance until the tab is opened", async () => {
    fetchPortfolioPerformanceRangeMock.mockResolvedValue({
      isAvailable: true,
      methodology: "time_weighted_return",
      scope: "symbol_assets",
      history: [
        {
          date: new Date("2026-01-01T00:00:00.000Z"),
          dateKey: toCivilDateKeyOrThrow("2026-01-01"),
          cumulativeReturnPct: 0,
        },
        {
          date: new Date("2026-01-02T00:00:00.000Z"),
          dateKey: toCivilDateKeyOrThrow("2026-01-02"),
          cumulativeReturnPct: 12,
        },
      ],
      summary: {
        startDateKey: toCivilDateKeyOrThrow("2026-01-01"),
        endDateKey: toCivilDateKeyOrThrow("2026-01-02"),
        cumulativeReturnPct: 12,
      },
      unavailableReason: null,
      message: null,
    });

    render(
      <NetWorthAreaChart
        currency="USD"
        netWorth={1000}
        history={[
          {
            date: new Date("2026-01-01T00:00:00.000Z"),
            dateKey: toCivilDateKeyOrThrow("2026-01-01"),
            value: 1000,
          },
        ]}
        change={{
          currentDateKey: toCivilDateKeyOrThrow("2026-01-02"),
          previousDateKey: toCivilDateKeyOrThrow("2025-10-02"),
          currentValue: 1000,
          previousValue: 900,
          absoluteChange: 100,
          percentageChange: 11.11,
        }}
        todayDateKey={toCivilDateKeyOrThrow("2026-01-02")}
        netWorthMode="gross"
        estimatedCapitalGainsTax={null}
        performanceEligibility={{
          isEligible: true,
          unavailableReason: null,
          message: null,
        }}
      />,
    );

    expect(fetchPortfolioPerformanceRangeMock).not.toHaveBeenCalled();

    const performanceTab = screen.getByRole("tab", {
      name: /^performance/i,
    });

    fireEvent.mouseDown(performanceTab);
    fireEvent.click(performanceTab);

    await waitFor(() => {
      expect(fetchPortfolioPerformanceRangeMock).toHaveBeenCalledTimes(1);
    });
  });

  it("disables the performance tab when the account is not eligible", () => {
    render(
      <NetWorthAreaChart
        currency="USD"
        netWorth={1000}
        history={[
          {
            date: new Date("2026-01-01T00:00:00.000Z"),
            dateKey: toCivilDateKeyOrThrow("2026-01-01"),
            value: 1000,
          },
        ]}
        change={{
          currentDateKey: toCivilDateKeyOrThrow("2026-01-02"),
          previousDateKey: toCivilDateKeyOrThrow("2025-10-02"),
          currentValue: 1000,
          previousValue: 900,
          absoluteChange: 100,
          percentageChange: 11.11,
        }}
        todayDateKey={toCivilDateKeyOrThrow("2026-01-02")}
        netWorthMode="gross"
        estimatedCapitalGainsTax={null}
        performanceEligibility={{
          isEligible: false,
          unavailableReason: "no_eligible_positions",
          message:
            "Performance is available only for symbol-backed investments.",
        }}
      />,
    );

    expect(
      screen
        .getByRole("tab", { name: /^performance/i })
        ?.hasAttribute("disabled"),
    ).toBe(true);
    expect(fetchPortfolioPerformanceRangeMock).not.toHaveBeenCalled();
  });
});
