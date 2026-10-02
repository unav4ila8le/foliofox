import Link from "next/link";

import { DiscordIcon } from "@/components/ui/logos/discord-icon";
import { FoliofoxLogo } from "@/components/ui/logos/foliofox-logo";
import { GithubIcon } from "@/components/ui/logos/github-icon";

import { PUBLIC_LEGAL_LINKS } from "@/lib/legal/registry";

export async function Footer() {
  "use cache";

  const currentYear = new Date().getFullYear();

  return (
    <footer className="text-muted-foreground border-t text-sm">
      <div className="container mx-auto max-w-7xl px-3">
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-12 lg:py-16">
          <div>
            <Link href="/" aria-label="Foliofox - Go to homepage">
              <FoliofoxLogo height={26} />
            </Link>
            <p className="mt-4 max-w-xs leading-6">
              Portfolio intelligence and net worth tracking, all in one place.
            </p>
          </div>

          <nav aria-label="Use cases">
            <p className="text-foreground font-semibold">Use cases</p>
            <div className="mt-4 space-y-3">
              <Link
                href="/portfolio-tracker"
                className="hover:text-foreground block transition-colors"
              >
                Portfolio Tracker
              </Link>
              <Link
                href="/ai-financial-planning"
                className="hover:text-foreground block transition-colors"
              >
                AI Financial Planning
              </Link>
            </div>
          </nav>

          <nav aria-label="Resources">
            <p className="text-foreground font-semibold">Resources</p>
            <div className="mt-4 space-y-3">
              <Link
                href="/changelog"
                className="hover:text-foreground block transition-colors"
              >
                Changelog
              </Link>
              <a
                href="https://github.com/unav4ila8le/foliofox"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <GithubIcon className="size-4" />
                GitHub
              </a>
              <a
                href="/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-[#5865F2]"
              >
                <DiscordIcon width={16} />
                Join our Discord
              </a>
            </div>
          </nav>

          <nav aria-label="Legal">
            <p className="text-foreground font-semibold">Legal</p>
            <div className="mt-4 space-y-3">
              {PUBLIC_LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-foreground block transition-colors"
                >
                  {link.title}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t py-6 font-medium sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright © {currentYear}. All rights reserved.</p>
          <p>v0.1.0-beta</p>
        </div>
      </div>
    </footer>
  );
}
