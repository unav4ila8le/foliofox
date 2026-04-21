import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentView } from "@/components/features/legal/legal-document-view";

import { fetchLegalDocument } from "@/lib/legal/fetch";
import { LEGAL_DOCUMENTS } from "@/lib/legal/registry";
import { getRequestLocale } from "@/lib/locale/resolve-locale";

const privacyDocument = LEGAL_DOCUMENTS.privacy;

export async function generateMetadata(): Promise<Metadata> {
  const document = await fetchLegalDocument(privacyDocument.slug);

  if (!document) {
    return {
      title: privacyDocument.title,
    };
  }

  return {
    title: document.title,
    description: document.description,
    openGraph: {
      title: document.title,
      description: document.description,
      type: "article",
    },
  };
}

export default async function PrivacyPage() {
  const [document, locale] = await Promise.all([
    fetchLegalDocument(privacyDocument.slug),
    getRequestLocale(),
  ]);

  if (!document) {
    notFound();
  }

  return <LegalDocumentView document={document} locale={locale} />;
}
