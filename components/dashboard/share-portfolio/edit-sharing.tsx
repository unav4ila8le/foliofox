"use client";

import { useState } from "react";
import { Pencil, Link2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  SHARE_DURATIONS,
  SLUG_PATTERN,
  MAX_SLUG_LENGTH,
} from "@/lib/public-portfolio";

import type {
  PublicPortfolioMetadata,
  ShareDuration,
} from "@/types/global.types";

export type EditSharingFormValues = z.infer<typeof formSchema>;

const formSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, { error: "Slug must contain at least 3 characters." })
    .max(MAX_SLUG_LENGTH, {
      error: `Slug must not exceed ${MAX_SLUG_LENGTH} characters.`,
    })
    .regex(SLUG_PATTERN, {
      error:
        "Slug can only contain lowercase letters and numbers, without spaces.",
    })
    .transform((value) => value.toLowerCase()),
  duration: z.enum(SHARE_DURATIONS),
});

type EditSharingProps = {
  shareMetadata: PublicPortfolioMetadata;
  onSubmit: (values: EditSharingFormValues) => void;
  isUpdating?: boolean;
};

export function EditSharing({
  shareMetadata,
  onSubmit,
  isUpdating = false,
}: EditSharingProps) {
  const [open, setOpen] = useState(false);

  // Get site URL from environment with fallback
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://foliofox.ai";

  const form = useForm<EditSharingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: shareMetadata.slug,
      duration: "24h",
    },
  });

  // Submit handler
  async function handleSubmit(values: EditSharingFormValues) {
    try {
      await onSubmit(values);
      form.reset(values);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't update the link. Please try again.",
      );
    }
  }

  const isDirty = form.formState.isDirty;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" disabled={isUpdating}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit public link</DialogTitle>
          <DialogDescription>
            Update the slug or extend the link lifetime. Saving applies the
            changes immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-4"
          >
            {/* Slug */}
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={field.name}>Slug</FormLabel>
                  <FormControl>
                    <ButtonGroup className="w-full">
                      <ButtonGroupText asChild>
                        <Label>{siteUrl}/portfolio/</Label>
                      </ButtonGroupText>
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          placeholder="myportfolio"
                          {...field}
                        />
                        <InputGroupAddon align="inline-end">
                          <Link2 />
                        </InputGroupAddon>
                      </InputGroup>
                    </ButtonGroup>
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Lowercase letters and numbers only. Saving updates your
                    portfolio&apos;s public URL and invalidates any previous
                    link.
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem className="sm:w-1/2 sm:pr-1">
                  <FormLabel htmlFor={field.name}>Expire after</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {SHARE_DURATIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {labelForDuration(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Footer - Action buttons */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isUpdating}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isUpdating || !isDirty}>
                {isUpdating ? (
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
      </DialogContent>
    </Dialog>
  );
}

function labelForDuration(duration: ShareDuration) {
  switch (duration) {
    case "24h":
      return "24 hours";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    default:
      return duration;
  }
}
