"use client";

import { useState } from "react";
import { Pencil, Link2 } from "lucide-react";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
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
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  StickyDialogBody,
  StickyDialogContent,
  StickyDialogFooter,
  StickyDialogHeader,
} from "@/components/ui/custom/sticky-dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  PUBLIC_PORTFOLIO_EXPIRATIONS,
  SLUG_PATTERN,
  MAX_SLUG_LENGTH,
} from "@/lib/public-portfolio";

import type {
  PublicPortfolioMetadata,
  PublicPortfolioExpirationOption,
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
  expiration: z.enum(PUBLIC_PORTFOLIO_EXPIRATIONS),
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

  const fallbackSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://foliofox.com";
  let siteUrl = fallbackSiteUrl;
  try {
    siteUrl = new URL(shareMetadata.shareUrl).origin;
  } catch {
    siteUrl = fallbackSiteUrl;
  }

  const form = useForm<EditSharingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: shareMetadata.slug,
      expiration: PUBLIC_PORTFOLIO_EXPIRATIONS[0],
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
      <StickyDialogContent className="sm:max-w-lg">
        <StickyDialogHeader>
          <DialogTitle>Edit public link</DialogTitle>
          <DialogDescription>
            Update the slug or extend the link lifetime. Saving applies the
            changes immediately.
          </DialogDescription>
        </StickyDialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <StickyDialogBody>
            <div className="grid gap-4">
              {/* Slug */}
              <Controller
                control={form.control}
                name="slug"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
                    <ButtonGroup className="w-full">
                      <ButtonGroupText asChild>
                        <Label>
                          <span className="sm:hidden">/portfolio/</span>
                          <span className="hidden sm:inline">
                            {siteUrl}/portfolio/
                          </span>
                        </Label>
                      </ButtonGroupText>
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          placeholder="myportfolio"
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                        <InputGroupAddon align="inline-end">
                          <Link2 />
                        </InputGroupAddon>
                      </InputGroup>
                    </ButtonGroup>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                    <FieldDescription>
                      Lowercase letters and numbers only. Saving updates your
                      portfolio&apos;s public URL and invalidates any previous
                      link.
                    </FieldDescription>
                  </Field>
                )}
              />

              {/* Expiration */}
              <Controller
                control={form.control}
                name="expiration"
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="sm:w-1/2 sm:pr-1"
                  >
                    <FieldLabel htmlFor={field.name}>Expire after</FieldLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      value={field.value}
                    >
                      <SelectTrigger
                        className="w-full"
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select expiration" />
                      </SelectTrigger>
                      <SelectContent>
                        {PUBLIC_PORTFOLIO_EXPIRATIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {labelForExpiration(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </StickyDialogBody>

          <StickyDialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isUpdating}>
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
          </StickyDialogFooter>
        </form>
      </StickyDialogContent>
    </Dialog>
  );
}

function labelForExpiration(expiration: PublicPortfolioExpirationOption) {
  switch (expiration) {
    case "24h":
      return "24 hours";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    default:
      return "Never";
  }
}
