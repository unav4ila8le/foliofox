import Link from "next/link";
import { Suspense } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logos/logo";
import { GithubLogo } from "@/components/ui/logos/github-logo";
import { UserMenu } from "@/components/features/user/user-menu";

import { fetchOptionalProfile } from "@/server/profile/actions";

function CTAButton({ cta = "Get started" }: { cta?: string }) {
  return (
    <Button asChild size="sm">
      <Link href="/auth/login">{cta}</Link>
    </Button>
  );
}

async function OptionalProfileWrapper({ cta }: { cta?: string }) {
  const data = await fetchOptionalProfile();
  const profile = data?.profile;
  const email = data?.email ?? "";

  if (profile) {
    const avatarUrl = profile.avatar_url || undefined;
    const username = profile.username || "User";
    const initial = username.slice(0, 1);

    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="h-7">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <UserMenu profile={profile} email={email} menuAlign="end">
          <Avatar className="cursor-pointer">
            <AvatarImage src={avatarUrl} alt={username} />
            <AvatarFallback className="bg-background uppercase">
              {initial}
            </AvatarFallback>
          </Avatar>
        </UserMenu>
      </div>
    );
  }

  return <CTAButton cta={cta} />;
}

export async function Header({ cta = "Get started" }: { cta?: string }) {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" aria-label="Foliofox - Go to homepage">
        <Logo />
      </Link>

      <nav className="flex items-center gap-2">
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
        <Suspense fallback={<CTAButton cta={cta} />}>
          <OptionalProfileWrapper cta={cta} />
        </Suspense>
      </nav>
    </header>
  );
}
