import type { Metadata } from "next";
import { format } from "date-fns";

import { parseChangelogs } from "@/lib/changelog/parse";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Latest updates and improvements to Foliofox.",
};

export default async function ChangelogPage() {
  const changelogs = await parseChangelogs();

  if (changelogs.length === 0) {
    return <p className="text-muted-foreground">No changelog entries found.</p>;
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-12 p-3 md:mt-8">
      {changelogs.map((entry) => (
        <article
          key={entry.slug}
          className="grid grid-cols-12 gap-4 pb-12 not-last:border-b"
        >
          {/* Left sidebar */}
          <div className="col-span-12 md:col-span-3">
            <div className="sticky top-8">
              <h1 className="text-lg font-semibold">{entry.title}</h1>
              <time className="text-muted-foreground text-sm">
                {format(new Date(entry.date), "MMM d, yyyy")}
              </time>
            </div>
          </div>

          {/* Main content */}
          <div
            className="prose prose-neutral dark:prose-invert col-span-12 md:col-span-6 [&_img]:rounded-sm"
            dangerouslySetInnerHTML={{ __html: entry.content }}
          />
        </article>
      ))}
    </div>
  );
}
