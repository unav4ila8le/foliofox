import { formatDate } from "@/lib/date/date-format";
import type { LegalDocument } from "@/lib/legal/types";

interface LegalDocumentViewProps {
  document: LegalDocument;
  locale: string;
}

export function LegalDocumentView({
  document,
  locale,
}: LegalDocumentViewProps) {
  const effectiveDate = formatDate(document.effectiveDate, {
    locale,
    timeZone: "UTC",
  });
  const lastUpdated = formatDate(document.lastUpdated, {
    locale,
    timeZone: "UTC",
  });

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-3 py-8 md:py-16">
      <header className="space-y-4 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {document.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
          {document.description}
        </p>
        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <p>
            Effective date:{" "}
            <time className="text-foreground" dateTime={document.effectiveDate}>
              {effectiveDate}
            </time>
          </p>
          <p>
            Last updated:{" "}
            <time className="text-foreground" dateTime={document.lastUpdated}>
              {lastUpdated}
            </time>
          </p>
        </div>
      </header>

      <article
        className="prose prose-neutral dark:prose-invert [&_a]:wrap-break-words max-w-none [&_img]:rounded-sm"
        dangerouslySetInnerHTML={{ __html: document.content }}
      />
    </div>
  );
}
