"use client";

import Link from "next/link";
import { useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";

import { signUp } from "@/server/auth/sign-up";

const formSchema = z
  .object({
    email: z.email({ error: "Please enter a valid email address." }).trim(),
    username: z
      .string()
      .trim()
      .min(3, { error: "Username must be at least 3 characters." })
      .max(16, { error: "Username must not exceed 16 characters." })
      .regex(/^[a-zA-Z0-9]+$/, {
        error: "Username can only contain letters and numbers, without spaces.",
      }),
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

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      repeatPassword: "",
    },
  });

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", values.email.trim().toLowerCase());
      formData.append("username", values.username.trim());
      formData.append("password", values.password);

      const result = await signUp(formData);

      // Handle expected auth errors
      if (!result.success) {
        if (result.code === "user_already_exists") {
          form.setError("email", {
            type: "manual",
            message: result.message,
          });
        } else if (result.code === "username_check_error") {
          form.setError("username", {
            type: "manual",
            message: result.message,
          });
        } else if (result.code === "username_already_exists") {
          form.setError("username", {
            type: "manual",
            message: result.message,
          });
        } else {
          toast.error("Signup failed", {
            description: result.message,
          });
        }
        return;
      }

      toast.success("Check your inbox to confirm your account", {
        description:
          "Click the confirmation link in the email to complete signup.",
        position: "top-center",
        duration: 8000,
      });
      form.reset();
    } catch (error) {
      // Handle unexpected errors
      toast.error("Signup failed", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. If the problem persists, please contact support.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign up here</CardTitle>
        <CardDescription>Create a new account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="mail@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
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
                  <FormLabel>Repeat password</FormLabel>
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
                  <Spinner />
                  Signing up...
                </>
              ) : (
                "Sign up"
              )}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Log in instead
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
