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
      const result = await signout(scope);

      // Handle expected auth errors
      if (result.success === false) {
        toast.error("Failed to log out", {
          description: result.message,
        });
        return;
      }

      router.push("/auth/login");
      toast.success("You have been signed out successfully");
    } catch (error) {
      // Handle unexpected errors
      toast.error("Failed to log out", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. If the problem persists, please contact support.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignOut, isLoading };
}
