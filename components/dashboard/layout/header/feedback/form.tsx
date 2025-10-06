"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: undefined,
      message: "",
    },
  });

  // Get isDirty and isSubmitting state from formState
  const { isDirty, isSubmitting } = form.formState;

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData();
    formData.append("type", values.type);
    formData.append("message", values.message.trim());

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
    <Form {...form}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What would you like to share?</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col"
                >
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <RadioGroupItem value="issue" />
                    </FormControl>
                    <FormLabel className="font-normal">Issue</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <RadioGroupItem value="idea" />
                    </FormControl>
                    <FormLabel className="font-normal">Idea</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <RadioGroupItem value="other" />
                    </FormControl>
                    <FormLabel className="font-normal">Other</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write your feedback here..."
                  className="max-h-64"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
      </form>
    </Form>
  );
}
