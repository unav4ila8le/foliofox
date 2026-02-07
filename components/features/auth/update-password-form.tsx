"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { updatePassword } from "@/server/auth/update-password";

const formSchema = z
  .object({
    password: z
      .string()
      .min(6, { error: "Password must be at least 6 characters." })
      .max(20, { error: "Password must not exceed 20 characters." }),
    repeatPassword: z.string(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    error: "Passwords do not match.",
    path: ["repeatPassword"],
  });

export function UpdatePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      repeatPassword: "",
    },
  });

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    const formData = new FormData();
    formData.append("password", values.password);

    const result = await updatePassword(formData);

    // Handle expected auth errors
    if (!result.success) {
      toast.error("Failed to update password", {
        description: result.message,
      });
      setIsLoading(false);
    } else {
      toast.success("Password updated successfully!", {
        description: "You can now log in with your new password.",
        position: "top-center",
        duration: 8000,
      });
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Set new password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                <Input
                  id={field.name}
                  type="password"
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
            name="repeatPassword"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Confirm new password
                </FieldLabel>
                <Input
                  id={field.name}
                  type="password"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button disabled={isLoading} type="submit">
            {isLoading ? (
              <>
                <Spinner />
                Updating...
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
