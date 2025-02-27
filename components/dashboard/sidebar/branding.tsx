import { Logo } from "@/components/ui/logo";
import { Logomark } from "@/components/ui/logomark";
import { useSidebar } from "@/components/ui/sidebar";

import { cn } from "@/lib/utils";

export function Branding() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="flex flex-col items-center gap-2">
      {isCollapsed ? <Logomark height={24} /> : <Logo height={24} />}
      <p
        className={cn(
          "text-muted-foreground truncate text-center text-xs",
          isCollapsed && "hidden",
        )}
      >
        Copyright © {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}
