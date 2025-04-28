import { useState } from "react";

import { signout, type SignOutScope } from "@/server/auth/actions";

export function useSignout() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async (scope: SignOutScope = "global") => {
    setIsLoading(true);
    try {
      await signout(scope);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignOut, isLoading };
}
