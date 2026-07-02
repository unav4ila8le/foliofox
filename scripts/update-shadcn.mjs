#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const components = readdirSync(path.join(process.cwd(), "components/ui"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"))
  .map((entry) => entry.name.replace(/\.tsx$/, ""))
  .sort();

console.log(`Found ${components.length} shadcn components.`);

let errors = 0;

for (const component of components) {
  console.log(`\nUpdating ${component}...`);

  try {
    execFileSync(
      "npx",
      ["shadcn@latest", "add", "--yes", "--overwrite", component],
      {
        stdio: "inherit",
      },
    );
  } catch {
    errors += 1;
  }
}

if (errors > 0) {
  console.error(`\n${errors} component update(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll shadcn components updated.");
}
