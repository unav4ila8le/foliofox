import Link from "next/link";

import { Logo } from "@/components/ui/logos/logo";
import { Logomark } from "@/components/ui/logos/logomark";

export function Branding() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Link href="/">
        <Logo height={24} className="group-data-[state=collapsed]:hidden" />
        <Logomark
          height={24}
          className="hidden group-data-[state=collapsed]:block"
        />
      </Link>
      <p className="text-muted-foreground truncate text-center text-xs group-data-[state=collapsed]:hidden">
        Copyright © {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}
