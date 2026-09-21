"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogFooter,
} from "@/components/ui/custom/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { createFeedback } from "@/server/feedback/create";

const formSchema = z.object({
  type: z.enum(["issue", "idea", "other"], {
    error: "You need to select a feedback type",
  }),
  message: z
    .string()
    .min(64, {
      error: "Message must be at least 64 characters long.",
    })
    .max(1024, { error: "Message must be not longer than 1024 characters." }),
});

export function FeedbackForm({ onSuccess }: { onSuccess: () => void }) {
  const { profile, email } = useDashboardData();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: undefined,
      message: "",
    },
  });

  const { isDirty, isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append("type", values.type);
    formData.append("message", values.message.trim());
    formData.append("username", profile.username);
    formData.append("email", email);

    const result = await createFeedback(formData);

    if (result?.success) {
      toast.success("Feedback sent successfully");
      form.reset();
      onSuccess();
    } else {
      toast.error("Failed to send feedback", {
        description: result?.message,
      });
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <DialogBody>
        <div className="grid gap-4">
          <Controller
            control={form.control}
            name="type"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldTitle id={`${field.name}-label`}>
                  What would you like to share?
                </FieldTitle>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  aria-labelledby={`${field.name}-label`}
                  className="flex flex-col gap-3"
                >
                  <Label
                    htmlFor="feedback-issue"
                    className="flex items-center gap-3 font-normal"
                  >
                    <RadioGroupItem value="issue" id="feedback-issue" />
                    Issue
                  </Label>
                  <Label
                    htmlFor="feedback-idea"
                    className="flex items-center gap-3 font-normal"
                  >
                    <RadioGroupItem value="idea" id="feedback-idea" />
                    Idea
                  </Label>
                  <Label
                    htmlFor="feedback-other"
                    className="flex items-center gap-3 font-normal"
                  >
                    <RadioGroupItem value="other" id="feedback-other" />
                    Other
                  </Label>
                </RadioGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="message"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Message</FieldLabel>
                <Textarea
                  id={field.name}
                  placeholder="Write your feedback here..."
                  rows={4}
                  className="field-sizing-fixed max-h-64"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={isSubmitting} type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? (
            <>
              <Spinner />
              Sending...
            </>
          ) : (
            "Send feedback"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
