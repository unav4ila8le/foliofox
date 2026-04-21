import { readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

import { legalDocumentFrontmatterSchema, type LegalDocument } from "./types";

export async function fetchLegalDocument(
  slug: string,
): Promise<LegalDocument | null> {
  "use cache";

  const filePath = join(process.cwd(), "content", "legal", `${slug}.md`);

  let fileContent: string;

  try {
    fileContent = await readFile(filePath, "utf8");
  } catch (error) {
    console.warn(`Failed to read legal document: ${slug}.md`, error);
    return null;
  }

  try {
    const { data: frontmatter, content } = matter(fileContent);
    const parsedFrontmatter =
      legalDocumentFrontmatterSchema.safeParse(frontmatter);

    if (!parsedFrontmatter.success) {
      console.warn(
        `Invalid legal document frontmatter: ${slug}.md`,
        parsedFrontmatter.error.flatten().fieldErrors,
      );
      return null;
    }

    const processedContent = await remark()
      .use(remarkHtml, { sanitize: true })
      .process(content);

    return {
      slug,
      content: processedContent.toString(),
      ...parsedFrontmatter.data,
    };
  } catch (error) {
    console.warn(`Failed to parse legal document: ${slug}.md`, error);
    return null;
  }
}
