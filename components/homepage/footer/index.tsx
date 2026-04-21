import Link from "next/link";

import { DiscordIcon } from "@/components/ui/logos/discord-icon";

import { PUBLIC_LEGAL_LINKS } from "@/lib/legal/registry";

export async function Footer() {
  "use cache";

  const currentYear = new Date().getFullYear();

  return (
    <footer className="text-muted-foreground container mx-auto mt-8 grid max-w-7xl grid-cols-3 gap-4 p-3 py-6 text-sm font-medium">
      <div className="col-span-full sm:col-span-1">
        <Link
          href="https://discord.gg/9AGutMkvUR"
          target="_blank"
          className="flex items-center gap-1.5 justify-self-start transition-colors hover:text-[#5865F2]"
        >
          <DiscordIcon width={20} />
          <p>Join our Discord</p>
        </Link>
      </div>
      <div className="col-span-full sm:col-span-1">
        <p className="sm:text-center">
          Copyright © {currentYear}. All rights reserved.
          <br />
          v0.1.0-beta
        </p>
      </div>
      <nav className="col-span-full space-y-4 sm:col-span-1 sm:text-end">
        {PUBLIC_LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-foreground transition-colors"
          >
            {link.title}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
