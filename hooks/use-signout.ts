import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signout, type SignOutScope } from "@/server/auth/actions";

export function useSignout() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async (scope: SignOutScope = "global") => {
    setIsLoading(true);
    try {
      await signout(scope);
      router.push("/auth/login");
      toast.success("You have been signed out successfully");
    } catch (error) {
      // Show error message to user
      toast.error("Failed to log out", {
        description:
          error instanceof Error
            ? error.message
            : "Please refresh the page and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignOut, isLoading };
}
