import { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpsertEventForm } from "./form";

import { ld } from "@/lib/date/date-utils";
import type { ScenarioEvent } from "@/lib/planning/scenario/engine";

const routerRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => "en-US",
}));

vi.mock("@/server/financial-scenarios/upsert", () => ({
  upsertScenarioEvent: vi.fn(),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>calendar</div>,
}));

vi.mock("@/components/ui/custom/dialog", () => ({
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/custom/localized-number-input", () => ({
  LocalizedNumberInput: ({
    value,
    onValueChange,
    ...props
  }: {
    value?: string | number | null;
    onValueChange?: (value: string) => void;
  }) => (
    <input
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/input-group", () => ({
  InputGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  InputGroupAddon: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  InputGroupText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectValue: () => <span>select value</span>,
}));

const baseProps = {
  scenarioId: "scenario-1",
  currency: "USD",
  onCancel: vi.fn(),
};

describe("UpsertEventForm", () => {
  beforeEach(() => {
    baseProps.onCancel.mockReset();
    routerRefreshMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("offers the cash threshold condition for cash-based scenarios", () => {
    render(
      <UpsertEventForm
        {...baseProps}
        initialValueBasis="cash"
        existingEvents={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));

    expect(screen.getByText("Cash is Above")).toBeTruthy();
    expect(screen.queryByText("Net Worth is Above")).toBeNull();
  });

  it("shows manual-basis incompatibility guidance for preserved threshold conditions", () => {
    const event: ScenarioEvent = {
      name: "Car purchase",
      type: "expense",
      amount: 15000,
      recurrence: { type: "once" },
      unlockedBy: [
        {
          tag: "projected-series",
          type: "networth-is-above",
          value: { amount: 60000 },
        },
        {
          tag: "cashflow",
          type: "date-is",
          value: ld(2027, 3, 10),
        },
      ],
    };

    render(
      <UpsertEventForm
        {...baseProps}
        initialValueBasis="manual"
        event={event}
        eventIndex={0}
        existingEvents={[event]}
      />,
    );

    expect(
      screen.getByText(
        /Projected value threshold conditions are unavailable while Initial value uses Manual basis\./i,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Inactive while Initial value uses Manual basis\./i),
    ).toBeTruthy();
  });

  it("does not offer projected value threshold conditions for manual basis", () => {
    render(
      <UpsertEventForm
        {...baseProps}
        initialValueBasis="manual"
        existingEvents={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));

    expect(screen.queryByText("Cash is Above")).toBeNull();
    expect(screen.queryByText("Net Worth is Above")).toBeNull();
    expect(screen.getByText("Event Happened")).toBeTruthy();
    expect(screen.getByText("Income is Above")).toBeTruthy();
  });
});
