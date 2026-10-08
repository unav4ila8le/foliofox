import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { FoliofoxLogo } from "@/components/ui/logos/foliofox-logo";
import { GithubIcon } from "@/components/ui/logos/github-icon";
import { CTAWrapper } from "@/components/homepage/cta-wrapper";

export async function Header() {
  return (
    <header className="bg-primary-foreground/90 sticky top-0 z-50 w-full backdrop-blur-md">
      <div className="container mx-auto flex max-w-7xl items-center justify-between p-3">
        <Link href="/" aria-label="Foliofox - Go to homepage">
          <FoliofoxLogo />
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/portfolio-tracker"
            className="hidden text-sm font-medium transition-opacity hover:opacity-70 md:block"
          >
            Portfolio Tracker
          </Link>
          <Link
            href="/ai-financial-planning"
            className="hidden text-sm font-medium transition-opacity hover:opacity-70 md:block"
          >
            AI Financial Planning
          </Link>
          <Link
            href="/changelog"
            className="hidden text-sm font-medium transition-opacity hover:opacity-70 sm:block"
          >
            Changelog
          </Link>
          <Button
            asChild
            className="hidden sm:inline-flex"
            size="icon-sm"
            variant="ghost"
          >
            <Link
              href="https://github.com/unav4ila8le/foliofox"
              target="_blank"
              aria-label="Go to GitHub repository"
            >
              <GithubIcon />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">
              <Suspense fallback="Get started">
                <CTAWrapper />
              </Suspense>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
