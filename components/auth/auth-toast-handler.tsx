"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

export function AuthToastHandler() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const error = searchParams.get("error");

  useEffect(() => {
    if (message === "confirm-error") {
      toast.error("Email confirmation failed", {
        id: "auth-confirm-error-toast",
        description:
          error || "Please try again or request a new confirmation link.",
        position: "top-center",
        duration: 8000,
      });
    }
  }, [message, error]);

  return null; // This component doesn't render anything, it's just a toast handler
}
