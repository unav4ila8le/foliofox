"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { updateEmailPreferences } from "@/server/email-preferences/actions";
import { SettingsFormShell } from "@/components/features/settings/form-shell";

const emailSettingsFormSchema = z.object({
  weekly_recap_enabled: z.boolean(),
  marketing_emails_enabled: z.boolean(),
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsFormSchema>;

interface EmailSettingsFormProps {
  onSuccess?: () => void;
}

export function EmailSettingsForm({ onSuccess }: EmailSettingsFormProps) {
  const { emailPreferences, refreshDashboardData } = useDashboardData();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsFormSchema),
    defaultValues: {
      weekly_recap_enabled: emailPreferences.weekly_recap_enabled,
      marketing_emails_enabled: emailPreferences.marketing_emails_enabled,
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  async function onSubmit(values: EmailSettingsFormValues) {
    setIsLoading(true);

    try {
      const hasPreferenceChanges =
        values.weekly_recap_enabled !== emailPreferences.weekly_recap_enabled ||
        values.marketing_emails_enabled !==
          emailPreferences.marketing_emails_enabled;

      if (!hasPreferenceChanges) {
        onSuccess?.();
        return;
      }

      const emailPreferencesResult = await updateEmailPreferences({
        weeklyRecapEnabled: values.weekly_recap_enabled,
        marketingEmailsEnabled: values.marketing_emails_enabled,
      });

      if (!emailPreferencesResult.success) {
        throw new Error(emailPreferencesResult.message);
      }

      form.reset(values);
      toast.success("Email settings updated successfully");
      refreshDashboardData();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update email preferences",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <SettingsFormShell
        isLoading={isLoading}
        isSubmitDisabled={isLoading || !isDirty}
      >
        <div className="grid gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Automated emails</h3>
            <p className="text-muted-foreground text-sm">
              Control which automated emails Foliofox can send you.
            </p>
          </div>

          <Controller
            control={form.control}
            name="weekly_recap_enabled"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="rounded-lg border px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    id="weekly-recap-enabled"
                    checked={field.value}
                    disabled={isLoading}
                    onCheckedChange={(checked) => field.onChange(checked)}
                    aria-invalid={fieldState.invalid}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <FieldLabel htmlFor="weekly-recap-enabled">
                    Weekly recap
                  </FieldLabel>
                </div>
                <FieldDescription className="text-muted-foreground">
                  A summary of your weekly portfolio change, top movers, and
                  projected income.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="marketing_emails_enabled"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="rounded-lg border px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    id="marketing-emails-enabled"
                    checked={field.value}
                    disabled={isLoading}
                    onCheckedChange={(checked) => field.onChange(checked)}
                    aria-invalid={fieldState.invalid}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <FieldLabel htmlFor="marketing-emails-enabled">
                    Marketing emails
                  </FieldLabel>
                </div>
                <FieldDescription className="text-muted-foreground">
                  Reminders and future product nudges meant to bring you back
                  when there is something worth reviewing.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </SettingsFormShell>
    </form>
  );
}
