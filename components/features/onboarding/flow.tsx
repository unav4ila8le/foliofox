"use client";

import { toast } from "sonner";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import {
  AboutField,
  AgeBandField,
  IncomeFields,
  RiskPreferenceField,
} from "@/components/features/financial-profile/fields";
import {
  financialProfileFormSchema,
  toFinancialProfileFormData,
  type FinancialProfileFormValues,
} from "@/components/features/financial-profile/schema";

import { completeOnboarding, updateProfile } from "@/server/profile/actions";
import { upsertFinancialProfile } from "@/server/financial-profiles/actions";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Basics",
    description:
      "Your base currency is what every total is converted to. Both answers can be changed later.",
  },
  {
    title: "Income and risk",
    description:
      "Optional context for portfolio analysis and the AI advisor. You can change these later.",
  },
  {
    title: "Goals and context",
    description:
      "The advisor reads this when it explains or recommends anything. You can change these later.",
  },
  {
    title: "First position",
    description: "Pick whichever is easiest. The other paths stay available.",
  },
] as const;

const LAST_STEP = STEPS.length - 1;

/**
 * Whether there is anything worth storing. `income_currency` is excluded on
 * purpose: it is always populated from the base currency, so on its own it is
 * a default rather than an answer.
 */
function hasFinancialProfileAnswers(values: FinancialProfileFormValues) {
  return (
    values.age_band != null ||
    values.income_amount != null ||
    values.risk_preference != null ||
    (values.about ?? "") !== ""
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const { profile, financialProfile, refreshDashboardData } =
    useDashboardData();

  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState(profile.display_currency);

  // What is actually stored. Tracked separately because the income-currency
  // rule below needs the outgoing value, and `profile` only catches up after
  // refreshDashboardData() round-trips.
  const savedBaseCurrency = useRef(profile.display_currency);

  // One form across steps 1-3: upsertFinancialProfile rebuilds every column on
  // each call, so a partial submit would null the columns it omits.
  const form = useForm({
    resolver: zodResolver(financialProfileFormSchema),
    defaultValues: {
      age_band: financialProfile?.age_band ?? null,
      income_amount: financialProfile?.income_amount ?? null,
      income_currency:
        financialProfile?.income_currency ?? profile.display_currency,
      risk_preference: financialProfile?.risk_preference ?? null,
      about: financialProfile?.about ?? null,
    },
  });

  /**
   * The income-currency default tracks the base currency until the user picks
   * their own. Compare against the outgoing value, not the form's dirty state:
   * on a return visit a saved GBP loads as a pristine default and must survive
   * a later base-currency change.
   */
  function syncIncomeCurrency() {
    if (baseCurrency === savedBaseCurrency.current) return;
    if (form.getValues("income_currency") !== savedBaseCurrency.current) return;
    form.setValue("income_currency", baseCurrency);
  }

  async function saveBaseCurrency() {
    if (baseCurrency === savedBaseCurrency.current) return;

    // updateProfile validates all four fields, so round-trip the three this
    // step does not ask about, exactly as the account settings form does.
    const formData = new FormData();
    formData.append("username", profile.username);
    formData.append("display_currency", baseCurrency);
    formData.append("time_zone", profile.time_zone);
    formData.append("time_zone_mode", profile.time_zone_mode);

    const result = await updateProfile(formData);
    if (!result.success) {
      throw new Error(result.message);
    }

    savedBaseCurrency.current = baseCurrency;
    refreshDashboardData();
  }

  async function submitStep(values: FinancialProfileFormValues) {
    setIsLoading(true);
    try {
      // Not gated on step 1: skipping step 1 leaves the picked base currency
      // pending in state, and the next Continue is what commits it.
      await saveBaseCurrency();

      // Create a row only once it would hold an answer, so skipping the whole
      // flow leaves financial_profiles empty. Once a row exists keep writing to
      // it, so later edits and the income-currency follow both persist.
      if (financialProfile || hasFinancialProfileAnswers(values)) {
        const result = await upsertFinancialProfile(
          toFinancialProfileFormData(values),
        );
        if (!result.success) {
          throw new Error(result.error);
        }
      }

      setStep((current) => Math.min(current + 1, LAST_STEP));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save your answers",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleContinue() {
    // Sync before handleSubmit snapshots values for the upsert, or the write
    // would store the base currency it is replacing. Self-guards when unchanged.
    syncIncomeCurrency();
    void form.handleSubmit(submitStep)();
  }

  async function exitOnboarding() {
    setIsLoading(true);
    try {
      const result = await completeOnboarding();
      if (!result.success) {
        throw new Error(result.message);
      }
      router.replace("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to finish setup",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const { title, description } = STEPS[step];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleContinue();
      }}
      className="flex max-h-[calc(100svh-2rem)] w-full max-w-2xl flex-col gap-4"
    >
      <Card className="min-h-0 gap-0 py-0">
        <div className="flex gap-1 px-6 pt-6" aria-hidden>
          {STEPS.map((stepConfig, index) => (
            <div
              key={stepConfig.title}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                index <= step ? "bg-foreground" : "bg-border",
              )}
            />
          ))}
        </div>

        <div className="space-y-1 px-6 py-4">
          <h1 className="text-lg font-medium">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>

        <DialogBody>
          <div className="grid gap-6">
            {step === 0 && (
              <>
                <Field className="sm:w-1/2 sm:pr-1">
                  <FieldLabel htmlFor="display_currency">
                    Base currency
                  </FieldLabel>
                  <CurrencySelector
                    field={{ value: baseCurrency, onChange: setBaseCurrency }}
                    id="display_currency"
                  />
                </Field>
                <AgeBandField control={form.control} />
              </>
            )}

            {step === 1 && (
              <>
                <IncomeFields control={form.control} />
                <RiskPreferenceField control={form.control} />
              </>
            )}

            {step === 2 && (
              <AboutField
                control={form.control}
                rows={3}
                label="What should Foliofox know about you?"
                description="Goals, constraints, preferences, plans — anything the AI advisor should weigh when it analyses your portfolio or explains a decision."
              />
            )}

            {/* ponytail: Phase 3 replaces this with the four entry-point cards. */}
            {step === LAST_STEP && (
              <p className="text-muted-foreground text-sm">
                The add-position cards land in the next phase.
              </p>
            )}
          </div>
        </DialogBody>

        {/* Continue doubles as skip: no field is required, so an untouched
            step advances without writing anything. */}
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div>
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                disabled={isLoading}
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </Button>
            )}
          </div>
          {step < LAST_STEP ? (
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner />}
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={isLoading} onClick={exitOnboarding}>
              {isLoading && <Spinner />}
              Go to dashboard
            </Button>
          )}
        </DialogFooter>
      </Card>

      {step < LAST_STEP && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={exitOnboarding}
          className="text-muted-foreground self-center"
        >
          Skip setup
        </Button>
      )}
    </form>
  );
}
