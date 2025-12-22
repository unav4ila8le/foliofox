import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logos/logo";
import { GithubLogo } from "@/components/ui/logos/github-logo";
import { CTAWrapper } from "@/components/homepage/cta-wrapper";

export async function Header({ cta = "Get started" }: { cta?: string }) {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" aria-label="Foliofox - Go to homepage">
        <Logo />
      </Link>

      <nav className="flex items-center gap-2">
        <Link
          href="/changelog"
          className="text-sm font-medium hover:opacity-70"
        >
          Changelog
        </Link>
        <Button
          asChild
          size="icon-sm"
          variant="ghost"
          className="hover:bg-background"
        >
          <Link
            href="https://github.com/unav4ila8le/foliofox"
            target="_blank"
            aria-label="Go to GitHub repository"
          >
            <GithubLogo />
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/dashboard">
            <Suspense fallback={cta}>
              <CTAWrapper cta={cta} />
            </Suspense>
          </Link>
        </Button>
      </nav>
    </header>
  );
}
