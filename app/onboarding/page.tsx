import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Spinner } from "@/components/ui/spinner";
import { FoliofoxLogo } from "@/components/ui/logos/foliofox-logo";
import { DashboardDataProvider } from "@/components/dashboard/providers/dashboard-data-provider";
import { DashboardDialogsProvider } from "@/components/dashboard/providers/dashboard-dialogs-provider";
import { OnboardingFlow } from "@/components/features/onboarding/flow";

import { fetchDashboardData } from "@/server/dashboard/fetch-dashboard-data";

export const metadata = {
  title: "Set up your account",
};

export default function OnboardingPage() {
  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <FoliofoxLogo />
      <Suspense fallback={<Spinner className="size-5" />}>
        <OnboardingContent />
      </Suspense>
    </main>
  );
}

// Deliberately not "use cache: private": step 1 writes the display currency and
// step 2 reads it back on the same visit.
async function OnboardingContent() {
  // Request-time only: supabase auth calls Date.now(), which prerendering rejects
  await connection();

  const dashboardData = await fetchDashboardData();

  // Onboarding runs once. Anyone who finished or skipped belongs on the dashboard.
  if (dashboardData.profile.onboarding_completed_at) redirect("/dashboard");

  // NewAssetDialogProvider is the only add-position provider that reads
  // useDashboardData(); the rest of the app-wide providers live in app/layout.tsx.
  return (
    <DashboardDataProvider value={dashboardData}>
      <DashboardDialogsProvider>
        <OnboardingFlow />
      </DashboardDialogsProvider>
    </DashboardDataProvider>
  );
}
