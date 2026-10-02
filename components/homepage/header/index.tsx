import Link from "next/link";
import { Suspense } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FoliofoxLogo } from "@/components/ui/logos/foliofox-logo";
import { GithubIcon } from "@/components/ui/logos/github-icon";
import { CTAWrapper } from "@/components/homepage/cta-wrapper";

export async function Header() {
  return (
    <header className="bg-primary-foreground/90 sticky top-0 z-50 w-full backdrop-blur-md">
      <div className="relative container mx-auto flex max-w-7xl items-center justify-between p-3">
        <Link href="/" aria-label="Foliofox - Go to homepage">
          <FoliofoxLogo />
        </Link>

        <nav className="group absolute left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 text-sm font-medium transition-opacity group-hover:opacity-70">
            Use Cases
            <ChevronDownIcon className="size-3.5 transition-transform group-hover:rotate-180" />
          </span>
          <div className="invisible absolute top-full left-1/2 z-50 min-w-44 -translate-x-1/2 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
            <div className="bg-popover text-popover-foreground rounded-md border p-1 shadow-md">
              <Link
                href="/portfolio-tracker"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground block rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                Portfolio Tracker
              </Link>
              <Link
                href="/ai-financial-planning"
                className="hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground block rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                Financial Planning
              </Link>
            </div>
          </div>
        </nav>

        <nav className="flex items-center gap-2">
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
