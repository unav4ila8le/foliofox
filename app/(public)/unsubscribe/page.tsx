import Link from "next/link";

import { unsubscribeFromEmailPreference } from "@/server/email-preferences/unsubscribe";

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
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.18em] text-green-700 uppercase">
          Foliofox
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 text-sm leading-6">
          {description}
        </p>
        <div className="mt-6">
          <Link
            href={ctaHref}
            className="inline-flex rounded-full bg-green-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-800"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
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
        ctaLabel="Go to Foliofox"
        ctaHref="/"
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
