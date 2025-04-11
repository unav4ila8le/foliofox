import { redirect } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createClient } from "@/utils/supabase/server";
import { login, signup } from "@/lib/auth/actions";

export async function LoginForm() {
  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (data?.user && !error) {
    redirect("/dashboard");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Log in or Sign up here to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="mail@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button formAction={login}>Log in</Button>
          <Button formAction={signup} variant="outline">
            Sign up
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
