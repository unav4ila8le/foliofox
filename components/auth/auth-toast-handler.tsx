"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

export function AuthToastHandler() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  useEffect(() => {
    if (message === "signup-success") {
      toast.success("Please check your email to confirm your account", {
        id: "auth-signup-success-toast",
        description:
          "Click the confirmation link in the email to complete signup.",
        position: "top-center",
        duration: 8000,
      });
    } else if (message === "signout-success") {
      toast.success("You have been logged out successfully", {
        id: "auth-signout-success-toast",
      });
    }
  }, [message]);

  return null; // This component doesn't render anything, it's just a toast handler
}
