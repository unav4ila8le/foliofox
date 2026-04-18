"use client";

import { toast } from "sonner";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DialogClose } from "@/components/ui/custom/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { TimeZoneCombobox } from "@/components/features/settings/time-zone-combobox";
import {
  AUTO_TIME_ZONE_VALUE,
  getSupportedIanaTimeZones,
  isValidIanaTimeZone,
  normalizeIanaTimeZone,
  resolveBrowserTimeZone,
  TIME_ZONE_MODES,
} from "@/lib/date/time-zone";

import {
  updateProfile,
  checkUsernameAvailability,
} from "@/server/profile/actions";
import { updateEmailPreferences } from "@/server/email-preferences/actions";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";

interface SettingsFormProps {
  onSuccess?: () => void;
}

const formSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { error: "Username must be at least 3 characters." })
    .max(16, { error: "Username must not exceed 16 characters." })
    .regex(/^[a-zA-Z0-9]+$/, {
      error: "Username can only contain letters and numbers, without spaces.",
    }),
  display_currency: z.string({
    error: "Please select a currency.",
  }),
  time_zone: z
    .string({
      error: "Please select a timezone.",
    })
    .refine(
      (value) => value === AUTO_TIME_ZONE_VALUE || isValidIanaTimeZone(value),
      {
        error: "Please select a valid timezone.",
      },
    ),
  weekly_recap_enabled: z.boolean(),
  marketing_emails_enabled: z.boolean(),
});

function resolveInitialTimeZoneSelection(
  profileTimeZone: string | null,
  profileTimeZoneMode: string | null,
) {
  // Keep Auto sticky in the UI when user preference is auto mode.
  if (profileTimeZoneMode === TIME_ZONE_MODES.AUTO) {
    return AUTO_TIME_ZONE_VALUE;
  }

  // Fall back to concrete profile timezone for manual/legacy rows.
  const normalizedProfileTimeZone = profileTimeZone
    ? normalizeIanaTimeZone(profileTimeZone)
    : null;

  return normalizedProfileTimeZone ?? AUTO_TIME_ZONE_VALUE;
}

export function SettingsForm({ onSuccess }: SettingsFormProps) {
  const { profile, email, emailPreferences, refreshDashboardData } =
    useDashboardData();

  const [isLoading, setIsLoading] = useState(false);
  const detectedBrowserTimeZone = useMemo(() => resolveBrowserTimeZone(), []);
  const timeZoneOptions = useMemo(() => {
    const supportedTimeZones = getSupportedIanaTimeZones();

    // Keep currently saved value visible even if runtime support differs.
    const savedTimeZone = profile.time_zone
      ? normalizeIanaTimeZone(profile.time_zone)
      : null;

    if (
      savedTimeZone &&
      !supportedTimeZones.some((timeZone) => timeZone === savedTimeZone)
    ) {
      return [savedTimeZone, ...supportedTimeZones];
    }

    return supportedTimeZones;
  }, [profile.time_zone]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: profile.username,
      display_currency: profile.display_currency,
      time_zone: resolveInitialTimeZoneSelection(
        profile.time_zone,
        profile.time_zone_mode,
      ),
      weekly_recap_enabled: emailPreferences.weekly_recap_enabled,
      marketing_emails_enabled: emailPreferences.marketing_emails_enabled,
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const hasProfileChanges =
        values.username.trim() !== profile.username ||
        values.display_currency.trim().toUpperCase() !==
          profile.display_currency ||
        values.time_zone !==
          resolveInitialTimeZoneSelection(
            profile.time_zone,
            profile.time_zone_mode,
          );
      const hasEmailPreferenceChanges =
        values.weekly_recap_enabled !== emailPreferences.weekly_recap_enabled ||
        values.marketing_emails_enabled !==
          emailPreferences.marketing_emails_enabled;

      if (!hasProfileChanges && !hasEmailPreferenceChanges) {
        onSuccess?.();
        return;
      }

      if (values.username.trim() !== profile?.username) {
        const usernameCheck = await checkUsernameAvailability(
          values.username.trim(),
        );

        if (usernameCheck.error) {
          form.setError("username", {
            type: "manual",
            message:
              "Failed to verify username availability. Please try again.",
          });
          return;
        }

        if (!usernameCheck.available) {
          form.setError("username", {
            type: "manual",
            message:
              "This username is already taken. Please choose a different username.",
          });
          return;
        }
      }

      const isAutoTimeZone = values.time_zone === AUTO_TIME_ZONE_VALUE;
      const timeZoneMode = isAutoTimeZone
        ? TIME_ZONE_MODES.AUTO
        : TIME_ZONE_MODES.MANUAL;
      const resolvedTimeZone = isAutoTimeZone
        ? resolveBrowserTimeZone()
        : normalizeIanaTimeZone(values.time_zone);

      if (!resolvedTimeZone) {
        form.setError("time_zone", {
          type: "manual",
          message:
            "Could not detect a valid timezone from this browser. Please select one manually.",
        });
        return;
      }

      let didPersistAnySettings = false;

      if (hasProfileChanges) {
        const profileFormData = new FormData();
        profileFormData.append("username", values.username.trim());
        profileFormData.append(
          "display_currency",
          values.display_currency.trim().toUpperCase(),
        );
        profileFormData.append("time_zone", resolvedTimeZone);
        profileFormData.append("time_zone_mode", timeZoneMode);

        const profileResult = await updateProfile(profileFormData);

        if (!profileResult.success) {
          throw new Error(profileResult.message);
        }

        didPersistAnySettings = true;
      }

      if (hasEmailPreferenceChanges) {
        const emailPreferencesResult = await updateEmailPreferences({
          weeklyRecapEnabled: values.weekly_recap_enabled,
          marketingEmailsEnabled: values.marketing_emails_enabled,
        });

        if (!emailPreferencesResult.success) {
          throw new Error(
            didPersistAnySettings
              ? `${emailPreferencesResult.message} Some profile changes were already saved.`
              : emailPreferencesResult.message,
          );
        }

        didPersistAnySettings = true;
      }

      toast.success("Settings updated successfully");
      refreshDashboardData();

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
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
      <DialogBody>
        <div className="grid gap-4">
          {/* Username */}
          <Controller
            control={form.control}
            name="username"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  id={field.name}
                  autoComplete="username"
                  placeholder="username"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Display currency */}
          <Controller
            control={form.control}
            name="display_currency"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="sm:w-1/2 sm:pr-1"
              >
                <FieldLabel htmlFor={field.name}>Base currency</FieldLabel>
                <CurrencySelector
                  field={field}
                  id={field.name}
                  isInvalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
            {/* Time zone */}
            <Controller
              control={form.control}
              name="time_zone"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Time zone</FieldLabel>
                  <TimeZoneCombobox
                    field={field}
                    options={timeZoneOptions}
                    id={field.name}
                    isInvalid={fieldState.invalid}
                  />
                  {field.value === AUTO_TIME_ZONE_VALUE &&
                    detectedBrowserTimeZone && (
                      <FieldDescription>
                        {detectedBrowserTimeZone}
                      </FieldDescription>
                    )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Static locale field (not connected to form) */}
            <Field>
              <FieldLabel htmlFor="locale">Locale</FieldLabel>
              <Select disabled value="auto" name="locale" autoComplete="off">
                <SelectTrigger id="locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Date and number format.</FieldDescription>
            </Field>
          </div>

          {/* Read-only email field */}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              value={email}
              autoComplete="email"
              disabled
            />
            <FieldDescription>
              If you need to change your email, please contact support.
            </FieldDescription>
          </Field>

          <div id="email-preferences-section" className="grid gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Email preferences</h3>
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
                      onCheckedChange={field.onChange}
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
                      onCheckedChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                      className="data-[state=checked]:bg-green-500"
                    />
                    <FieldLabel htmlFor="marketing-emails-enabled">
                      Marketing emails
                    </FieldLabel>
                  </div>
                  <FieldDescription className="text-muted-foreground">
                    Re-engagement reminders and future product nudges meant to
                    bring you back when there is something worth reviewing.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={isLoading} type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={isLoading || !isDirty} type="submit">
          {isLoading ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
