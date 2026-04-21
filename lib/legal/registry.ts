export interface LegalDocumentRoute {
  href: `/${string}`;
  slug: string;
  title: string;
}

export const LEGAL_DOCUMENTS = {
  privacy: {
    href: "/privacy",
    slug: "privacy-policy",
    title: "Privacy Policy",
  },
} as const satisfies Record<string, LegalDocumentRoute>;

export const PUBLIC_LEGAL_LINKS = [LEGAL_DOCUMENTS.privacy] as const;
