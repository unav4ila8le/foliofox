"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";

export function AuthToastHandler() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  useEffect(() => {
    if (message === "signup-success") {
      toast.success("Please check your email to confirm your account", {
        id: "auth-signupsuccess-toast",
        description:
          "Click the confirmation link in the email to complete signup.",
        position: "top-center",
        duration: 8000,
        icon: <MailCheck />,
      });
    } else if (message === "signout-success") {
      toast.success("You have been logged out successfully", {
        id: "auth-signout-success-toast",
      });
    } else if (message === "user-already-exists") {
      toast.error("Account already exists", {
        id: "auth-error-toast",
        description: "Please log in with your existing account.",
        position: "top-center",
      });
    }
  }, [message]);

  return null; // This component doesn't render anything, it's just a toast handler
}
