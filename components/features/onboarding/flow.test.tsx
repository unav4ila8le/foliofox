import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "./flow";

const {
  completeOnboardingMock,
  updateProfileMock,
  upsertFinancialProfileMock,
} = vi.hoisted(() => ({
  completeOnboardingMock: vi.fn(),
  updateProfileMock: vi.fn(),
  upsertFinancialProfileMock: vi.fn(),
}));

const { routerMock } = vi.hoisted(() => ({
  routerMock: { replace: vi.fn() },
}));

vi.mock("@/server/profile/actions", () => ({
  completeOnboarding: completeOnboardingMock,
  updateProfile: updateProfileMock,
}));

vi.mock("@/server/financial-profiles/actions", () => ({
  upsertFinancialProfile: upsertFinancialProfileMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

// Step 4 reaches the add-position providers, whose module graph pulls in
// "use server" files importing next/headers. Keep all of that out of jsdom.
vi.mock("./first-position-step", () => ({
  FirstPositionStep: () => <div>first position step</div>,
}));

vi.mock("@/components/dashboard/providers/dashboard-data-provider", () => ({
  useDashboardData: () => ({
    profile: {
      username: "tester",
      display_currency: "USD",
      time_zone: "UTC",
      time_zone_mode: "manual",
    },
    financialProfile: null,
    refreshDashboardData: vi.fn(),
  }),
}));

// jsdom has no ResizeObserver; the currency selector's Radix popover needs one.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

vi.mock("@/hooks/use-currencies", () => ({
  useCurrencies: () => ({ currencies: [], isLoading: false }),
}));

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => "en-US",
}));

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeOnboardingMock.mockResolvedValue({ success: true });
    updateProfileMock.mockResolvedValue({ success: true });
    upsertFinancialProfileMock.mockResolvedValue({ success: true });
  });

  afterEach(cleanup);

  it("marks onboarding complete and leaves when setup is skipped", async () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByRole("button", { name: "Skip setup" }));

    // Forgetting to mark completion on skip is the infinite re-prompt the
    // onboarding_completed_at column exists to prevent.
    await waitFor(() => expect(completeOnboardingMock).toHaveBeenCalledOnce());
    expect(routerMock.replace).toHaveBeenCalledWith("/dashboard");
    expect(upsertFinancialProfileMock).not.toHaveBeenCalled();
  });

  it("writes nothing when continuing with the prefilled currency and no answers", async () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(screen.getByText("Income and risk")).toBeDefined(),
    );
    expect(updateProfileMock).not.toHaveBeenCalled();
    expect(upsertFinancialProfileMock).not.toHaveBeenCalled();
  });

  it("saves the financial profile once a question is answered", async () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByRole("radio", { name: "35-44" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Regression: this write used to be gated on formState.isDirty, which React
    // Hook Form only maintains once isDirty has been read during a render.
    await waitFor(() =>
      expect(upsertFinancialProfileMock).toHaveBeenCalledOnce(),
    );
    const formData = upsertFinancialProfileMock.mock
      .calls[0][0] as unknown as FormData;
    expect(formData.get("age_band")).toBe("35-44");
  });
});
