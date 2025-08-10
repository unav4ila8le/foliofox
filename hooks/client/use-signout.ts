"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/supabase/client";

export type SignOutScope = "global" | "local" | "others";

export function useSignout() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async (scope: SignOutScope = "global") => {
    setIsLoading(true);
    try {
      // Supabase client
      const supabase = createClient();

      // Sign out
      const { error } = await supabase.auth.signOut({ scope });

      // Throw error
      if (error) {
        toast.error("Failed to log out", {
          description: error.message,
        });
        setIsLoading(false);
        return;
      }

      // Redirect to login page
      router.replace("/auth/login");
      toast.success("You have been signed out successfully");
    } catch (error) {
      // Handle unexpected errors
      toast.error("Failed to log out", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. If the problem persists, please contact support.",
      });
      setIsLoading(false);
    }
  };

  return { handleSignOut, isLoading };
}
