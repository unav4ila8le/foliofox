import Link from "next/link";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { unsubscribeFromEmailPreference } from "@/server/email-preferences/unsubscribe";
import { Button } from "@/components/ui/button";

// This route is intentionally unauthenticated. The signed unsubscribe token
// in the query string is the sole authentication surface; do not gate this
// page on getCurrentUser() or it will break one-click unsubscribe from email
// clients that follow links without a user session.

function UnsubscribeCard({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="mx-auto my-8 max-w-xl p-3">
      <Card className="rounded-lg shadow-xs">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardFooter>
          <Button asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default async function UnsubscribePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const tokenParam = searchParams?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  if (!token) {
    return (
      <UnsubscribeCard
        title="This unsubscribe link is incomplete"
        description="The link you opened is missing the token we need to identify the email preference. Please use the link directly from the email footer."
        ctaLabel="Open dashboard"
        ctaHref="/dashboard"
      />
    );
  }

  const unsubscribeResult = await unsubscribeFromEmailPreference(token);

  if (!unsubscribeResult.success) {
    return (
      <UnsubscribeCard
        title="This unsubscribe link is no longer valid"
        description="The link may have expired or already been replaced. Open the latest email footer link, or sign in to Foliofox and update your preferences from settings."
        ctaLabel="Open dashboard settings"
        ctaHref="/dashboard?settings=emails"
      />
    );
  }

  if (unsubscribeResult.status === "already_disabled") {
    return (
      <UnsubscribeCard
        title={`${unsubscribeResult.preferenceLabel} already off`}
        description="Nothing else changed. If you want to turn these emails back on later, sign in to Foliofox and update your settings."
        ctaLabel="Open dashboard settings"
        ctaHref="/dashboard?settings=emails"
      />
    );
  }

  return (
    <UnsubscribeCard
      title={`${unsubscribeResult.preferenceLabel} turned off`}
      description="You will stop receiving this category of automated emails. You can turn it back on anytime from your Foliofox settings after signing in."
      ctaLabel="Open dashboard settings"
      ctaHref="/dashboard?settings=emails"
    />
  );
}
