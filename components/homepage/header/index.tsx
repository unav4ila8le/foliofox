import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logos/logo";
import { GithubLogo } from "@/components/ui/logos/github-logo";
import { UserMenu } from "@/components/features/user/user-menu";

import type { Profile } from "@/types/global.types";

export function Header({
  profile,
  email,
}: {
  profile?: Profile;
  email?: string;
}) {
  const avatarUrl = profile?.avatar_url || undefined;
  const username = profile?.username || "User";
  const initial = username.slice(0, 1);

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link href="/" aria-label="Foliofox - Go to homepage">
        <Logo />
      </Link>

      <div className="flex items-center gap-2">
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
        {profile ? (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-7">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserMenu profile={profile} email={email}>
              <Avatar className="cursor-pointer">
                <AvatarImage src={avatarUrl} alt={username} />
                <AvatarFallback className="bg-background uppercase">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </UserMenu>
          </div>
        ) : (
          <Button asChild size="sm">
            <Link href="/auth/login">Get started</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
