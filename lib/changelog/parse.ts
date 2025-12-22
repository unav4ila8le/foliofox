import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

import type { ChangelogEntry } from "./types";

export async function parseChangelogs(): Promise<ChangelogEntry[]> {
  "use cache";
  const changelogDir = join(process.cwd(), "content", "changelog");

  let files: string[] = [];

  try {
    files = await readdir(changelogDir);
  } catch (error) {
    console.warn("Failed to read changelog directory.", error);
    return [];
  }

  const fileNames = files.filter((file) => file.endsWith(".md"));

  const changelogResults = await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        const slug = fileName.replace(/\.md$/, "");
        const filePath = join(changelogDir, fileName);
        const fileContent = await readFile(filePath, "utf8");

        const { data: frontmatter, content } = matter(fileContent);
        const processedContent = await remark()
          .use(remarkHtml)
          .process(content);

        return {
          ...frontmatter,
          slug,
          content: processedContent.toString(),
        } as ChangelogEntry;
      } catch (error) {
        console.warn(`Failed to parse changelog file: ${fileName}`, error);
        return null;
      }
    }),
  );

  const changelogs = changelogResults.filter((entry): entry is ChangelogEntry =>
    Boolean(entry),
  );

  return changelogs.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
