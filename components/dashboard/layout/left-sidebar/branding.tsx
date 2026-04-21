import Link from "next/link";

import { FoliofoxLogo } from "@/components/ui/logos/foliofox-logo";
import { FoliofoxIcon } from "@/components/ui/logos/foliofox-icon";

export function Branding() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Link href="/" aria-label="Foliofox - Go to homepage">
        <FoliofoxLogo
          height={24}
          className="group-data-[state=collapsed]:hidden"
        />
        <FoliofoxIcon
          height={24}
          className="hidden group-data-[state=collapsed]:block"
        />
      </Link>
      <p className="text-muted-foreground truncate text-center text-xs group-data-[state=collapsed]:hidden">
        {/* Copyright © {new Date().getFullYear()}. All rights reserved. */}
        v0.1.0-beta
      </p>
    </div>
  );
}
