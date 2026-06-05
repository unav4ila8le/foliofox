"use client";

import { toast } from "sonner";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsFormShell } from "@/components/features/settings/form-shell";
import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { DeleteAccountDialog } from "@/components/features/settings/account/delete/dialog";
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
  checkUsernameAvailability,
  updateProfile,
} from "@/server/profile/actions";

const accountSettingsFormSchema = z.object({
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
});

type AccountSettingsFormValues = z.infer<typeof accountSettingsFormSchema>;

interface AccountSettingsFormProps {
  onSuccess?: () => void;
}

function resolveInitialTimeZoneSelection(
  profileTimeZone: string | null,
  profileTimeZoneMode: string | null,
) {
  // Keep Auto sticky in the UI when the saved preference is browser-driven.
  if (profileTimeZoneMode === TIME_ZONE_MODES.AUTO) {
    return AUTO_TIME_ZONE_VALUE;
  }

  const normalizedProfileTimeZone = profileTimeZone
    ? normalizeIanaTimeZone(profileTimeZone)
    : null;

  return normalizedProfileTimeZone ?? AUTO_TIME_ZONE_VALUE;
}

export function AccountSettingsForm({ onSuccess }: AccountSettingsFormProps) {
  const { email, profile, refreshDashboardData } = useDashboardData();
  const [isLoading, setIsLoading] = useState(false);

  const detectedBrowserTimeZone = useMemo(() => resolveBrowserTimeZone(), []);
  const initialTimeZoneSelection = useMemo(
    () =>
      resolveInitialTimeZoneSelection(
        profile.time_zone,
        profile.time_zone_mode,
      ),
    [profile.time_zone, profile.time_zone_mode],
  );
  const timeZoneOptions = useMemo(() => {
    const supportedTimeZones = getSupportedIanaTimeZones();
    const savedTimeZone = profile.time_zone
      ? normalizeIanaTimeZone(profile.time_zone)
      : null;

    // Keep the saved value visible even if this runtime supports a smaller
    // timezone list than the one used when the profile was last updated.
    if (
      savedTimeZone &&
      !supportedTimeZones.some((timeZone) => timeZone === savedTimeZone)
    ) {
      return [savedTimeZone, ...supportedTimeZones];
    }

    return supportedTimeZones;
  }, [profile.time_zone]);

  const form = useForm<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsFormSchema),
    defaultValues: {
      username: profile.username,
      display_currency: profile.display_currency,
      time_zone: initialTimeZoneSelection,
    },
  });

  const { isDirty } = form.formState;

  async function onSubmit(values: AccountSettingsFormValues) {
    setIsLoading(true);

    try {
      const normalizedUsername = values.username.trim();
      const normalizedDisplayCurrency = values.display_currency
        .trim()
        .toUpperCase();
      const hasProfileChanges =
        normalizedUsername !== profile.username ||
        normalizedDisplayCurrency !== profile.display_currency ||
        values.time_zone !== initialTimeZoneSelection;

      if (!hasProfileChanges) {
        onSuccess?.();
        return;
      }

      if (normalizedUsername !== profile.username) {
        const usernameAvailability =
          await checkUsernameAvailability(normalizedUsername);

        if (usernameAvailability.error) {
          form.setError("username", {
            type: "manual",
            message:
              "Failed to verify username availability. Please try again.",
          });
          return;
        }

        if (!usernameAvailability.available) {
          form.setError("username", {
            type: "manual",
            message:
              "This username is already taken. Please choose a different username.",
          });
          return;
        }
      }

      const isAutoTimeZone = values.time_zone === AUTO_TIME_ZONE_VALUE;
      const resolvedTimeZone = isAutoTimeZone
        ? (detectedBrowserTimeZone ?? resolveBrowserTimeZone())
        : normalizeIanaTimeZone(values.time_zone);

      if (!resolvedTimeZone) {
        form.setError("time_zone", {
          type: "manual",
          message:
            "Could not detect a valid timezone from this browser. Please select one manually.",
        });
        return;
      }

      const profileFormData = new FormData();
      profileFormData.append("username", normalizedUsername);
      profileFormData.append("display_currency", normalizedDisplayCurrency);
      profileFormData.append("time_zone", resolvedTimeZone);
      profileFormData.append(
        "time_zone_mode",
        isAutoTimeZone ? TIME_ZONE_MODES.AUTO : TIME_ZONE_MODES.MANUAL,
      );

      const updateProfileResult = await updateProfile(profileFormData);

      if (!updateProfileResult.success) {
        throw new Error(updateProfileResult.message);
      }

      form.reset({
        username: normalizedUsername,
        display_currency: normalizedDisplayCurrency,
        time_zone: isAutoTimeZone ? AUTO_TIME_ZONE_VALUE : resolvedTimeZone,
      });
      toast.success("Account settings updated successfully");
      refreshDashboardData();
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
      <SettingsFormShell
        isLoading={isLoading}
        isSubmitDisabled={isLoading || !isDirty}
      >
        <div className="grid gap-4">
          <Controller
            control={form.control}
            name="username"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  id={field.name}
                  autoComplete="username"
                  disabled={isLoading}
                  placeholder="username"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />

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
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />

          <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="time_zone"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Time zone</FieldLabel>
                  <TimeZoneCombobox
                    field={field}
                    id={field.name}
                    options={timeZoneOptions}
                    isInvalid={fieldState.invalid}
                  />
                  {field.value === AUTO_TIME_ZONE_VALUE &&
                  detectedBrowserTimeZone ? (
                    <FieldDescription>
                      {detectedBrowserTimeZone}
                    </FieldDescription>
                  ) : null}
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

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
              <a
                href="/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground"
              >
                Contact support
              </a>{" "}
              to change your email address.
            </FieldDescription>
          </Field>

          {/* Delete account */}
          <div className="border-border mt-2 rounded-lg border p-4">
            <h3 className="text-sm font-medium">Delete account</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Permanently remove your Personal Account and all of its contents
              from Foliofox. This action is not reversible, so please continue
              with caution.
            </p>
            <DeleteAccountDialog email={email} disabled={isLoading} />
          </div>
        </div>
      </SettingsFormShell>
    </form>
  );
}
