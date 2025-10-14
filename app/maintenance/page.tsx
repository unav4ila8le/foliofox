import Link from "next/link";

import { Logomark } from "@/components/ui/logos/logomark";

export default function MaintenancePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-4 text-center">
      <Link href="/" aria-label="Foliofox - Go to homepage">
        <Logomark
          height={40}
          className="hover:text-brand/70 transition-colors"
        />
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">We&apos;ll be back soon</h1>
      <p className="text-muted-foreground mt-2">
        Foliofox is undergoing scheduled maintenance. Please try again later.
      </p>
    </main>
  );
}
