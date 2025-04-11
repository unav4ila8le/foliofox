import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { login, signup } from "@/lib/auth/actions";

export default async function LoginPage() {
  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (data?.user && !error) {
    redirect("/dashboard");
  }

  return (
    <form>
      <label htmlFor="email">Email:</label>
      <input id="email" name="email" type="email" required />
      <label htmlFor="password">Password:</label>
      <input id="password" name="password" type="password" required />
      <button formAction={login}>Log in</button>
      <button formAction={signup}>Sign up</button>
    </form>
  );
}
