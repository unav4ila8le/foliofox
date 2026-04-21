import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const legalDocumentFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  effectiveDate: z.string().regex(isoDatePattern, "Expected YYYY-MM-DD"),
  lastUpdated: z.string().regex(isoDatePattern, "Expected YYYY-MM-DD"),
});

export type LegalDocumentFrontmatter = z.infer<
  typeof legalDocumentFrontmatterSchema
>;

export interface LegalDocument extends LegalDocumentFrontmatter {
  slug: string;
  content: string;
}
