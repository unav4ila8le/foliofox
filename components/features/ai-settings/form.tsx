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
import { Switch } from "@/components/ui/switch";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { updateAISettings } from "@/server/profile/actions";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";

interface AISettingsFormProps {
  onSuccess?: () => void;
}

const formSchema = z.object({
  data_sharing_consent: z.boolean(),
});

export function AISettingsForm({ onSuccess }: AISettingsFormProps) {
  const { profile } = useDashboardData();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      data_sharing_consent: profile.data_sharing_consent,
    },
  });

  // Get isDirty state from formState
  const { isDirty } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append(
        "data_sharing_consent",
        values.data_sharing_consent.toString(),
      );

      const result = await updateAISettings(formData);

      // Handle error response from server action
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success("AI data sharing consent updated successfully");

      // Close the dialog
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update AI data sharing consent",
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
          name="data_sharing_consent"
          render={({ field }) => (
            <FormItem className="rounded-lg border px-4 py-3 text-sm">
              <FormControl>
                <div className="flex items-center gap-2">
                  <Switch
                    id="data-sharing-consent"
                    checked={field.value}
                    disabled={isLoading}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <FormLabel htmlFor="data-sharing-consent">
                    AI data sharing consent
                  </FormLabel>
                </div>
              </FormControl>
              <FormDescription className="text-muted-foreground">
                Foliofox AI Advisor can provide more relevant answers if you
                choose to share different levels of data. This feature is
                powered by third-party AI providers.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
