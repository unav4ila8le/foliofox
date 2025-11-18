"use client";

import { toast } from "sonner";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CurrencySelector } from "@/components/dashboard/currency-selector";

import {
  updateProfile,
  checkUsernameAvailability,
} from "@/server/profile/actions";

import type { Profile } from "@/types/global.types";

interface SettingsFormProps {
  profile: Profile;
  email: string;
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

export function SettingsForm({ profile, email, onSuccess }: SettingsFormProps) {
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
      if (values.username.trim() !== profile.username) {
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="display_currency"
          render={({ field }) => (
            <FormItem className="sm:w-1/2">
              <FormLabel>Default currency</FormLabel>
              <FormControl>
                <CurrencySelector field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Read-only email field */}
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input value={email} disabled />
          </FormControl>
          <FormDescription>
            If you need to change your email, please contact support.
          </FormDescription>
          <FormMessage />
        </FormItem>

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button
              disabled={isLoading}
              type="button"
              variant="secondary"
              className="w-1/2 sm:w-auto"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={isLoading || !isDirty}
            type="submit"
            className="w-1/2 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Spinner />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
