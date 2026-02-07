"use client";

import Link from "next/link";
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

import { resetPassword } from "@/server/auth/reset-password";

const formSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }).trim(),
});

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    const formData = new FormData();
    formData.append("email", values.email.trim().toLowerCase());

    const result = await resetPassword(formData);

    // Handle expected auth errors
    if (!result.success) {
      toast.error("Failed to send reset link", {
        description: result.message,
      });
    } else {
      toast.success("Check your inbox for a reset link", {
        description:
          "If an account exists with this email, you'll receive a password reset link shortly.",
        position: "top-center",
        duration: 8000,
      });
      form.reset();
    }
    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email address and we will send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  placeholder="mail@example.com"
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
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Remember your password?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Log in instead
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
