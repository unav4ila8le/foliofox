#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read registry
const registryPath = path.join(__dirname, "../shadcn-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

// Get all .tsx files in components/ui (excluding subdirectories like ai/ and logos/)
const uiPath = path.join(__dirname, "../components/ui");
const allFiles = fs.readdirSync(uiPath);

// Filter to only .tsx files and extract component names (without extension)
const allComponents = allFiles
  .filter(
    (file) =>
      file.endsWith(".tsx") && fs.statSync(path.join(uiPath, file)).isFile(),
  )
  .map((file) => file.replace(".tsx", ""));

// Filter out excluded components
const componentsToUpdate = allComponents.filter(
  (component) => !registry.exclude.includes(component),
);

console.log(`📦 Found ${allComponents.length} components in ui/`);
console.log(
  `🔒 Excluding ${registry.exclude.length}: ${registry.exclude.join(", ")}`,
);
console.log(`✅ Updating ${componentsToUpdate.length} components...\n`);

let successCount = 0;
let errorCount = 0;

for (const component of componentsToUpdate) {
  try {
    const command = `npx shadcn@latest add -y -o ${component}`;

    console.log(`Updating ${component}...`);
    execSync(command, { stdio: "pipe" });

    successCount++;
  } catch {
    console.error(`❌ Error updating ${component}`);
    errorCount++;
  }
}

console.log("\n✅ Update complete!");
console.log(`Updated: ${successCount}`);
console.log(`Errors: ${errorCount}`);
