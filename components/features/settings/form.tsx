"use client";

import { toast } from "sonner";
import { useState } from "react";
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
import { DialogClose } from "@/components/ui/custom/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import {
  updateProfile,
  checkUsernameAvailability,
} from "@/server/profile/actions";
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
});

export function SettingsForm({ onSuccess }: SettingsFormProps) {
  const { profile, email } = useDashboardData();

  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: profile.username,
      display_currency: profile.display_currency,
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
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

      const formData = new FormData();
      formData.append("username", values.username.trim());
      formData.append(
        "display_currency",
        values.display_currency.trim().toUpperCase(),
      );

      const result = await updateProfile(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("Profile updated successfully");

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
          <Controller
            control={form.control}
            name="username"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  id={field.name}
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

          <Controller
            control={form.control}
            name="display_currency"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:w-1/2">
                <FieldLabel htmlFor={field.name}>Base currency</FieldLabel>
                <CurrencySelector
                  field={field}
                  isInvalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Static locale field (not connected to form) */}
          <Field className="sm:w-1/2">
            <FieldLabel htmlFor="locale">Locale</FieldLabel>
            <Select disabled value="auto">
              <SelectTrigger id="locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>Date and number format.</FieldDescription>
          </Field>

          {/* Read-only email field */}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={email} disabled />
            <FieldDescription>
              If you need to change your email, please contact support.
            </FieldDescription>
          </Field>
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
