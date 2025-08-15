"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { updatePassword } from "@/server/auth/actions";

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

    if (result.success) {
      toast.success("Password updated successfully!", {
        description: "You can now log in with your new password.",
        position: "top-center",
        duration: 8000,
      });
    } else {
      toast.error("Failed to update password", {
        description: result.message,
      });
    }

    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Set new password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="repeatPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button disabled={isLoading} type="submit">
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
