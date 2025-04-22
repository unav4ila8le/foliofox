"use client";

import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { updateProfile } from "@/lib/profile/actions";

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
    .min(3, "Username must be at least 3 characters.")
    .max(16, "Username must not exceed 16 characters.")
    .regex(/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers."),
  display_currency: z.string({
    required_error: "Please select a currency.",
  }),
});

export function SettingsForm({ profile, onSuccess, email }: SettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
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
      const formData = new FormData();
      formData.append("username", values.username);
      formData.append("display_currency", values.display_currency);

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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
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
          <Button disabled={isLoading || !isDirty} type="submit">
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
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
