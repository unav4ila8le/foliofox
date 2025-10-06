#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read registry
const registryPath = path.join(__dirname, "../shadcn-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

// Parse arguments
const args = process.argv.slice(2);
const isSafeMode = args.includes("--safe");
const forceOverwrite = args.includes("-o") || args.includes("--overwrite");

const componentsToUpdate = registry.components;

console.log(`📦 Updating ${componentsToUpdate.length} shadcn components...\n`);

if (isSafeMode) {
  console.log("⚠️  Running in SAFE mode - will skip if file exists\n");
}

let successCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const component of componentsToUpdate) {
  try {
    const overwriteFlag = forceOverwrite || !isSafeMode ? "-y -o" : "-y";
    const command = `npx shadcn@latest add ${overwriteFlag} ${component}`;

    console.log(`Updating ${component}...`);
    execSync(command, { stdio: "pipe" });

    successCount++;
  } catch (error) {
    if (
      error.message.includes("already exists") ||
      error.message.includes("Skipped")
    ) {
      console.log(`⏭️  Skipped ${component} (already exists)`);
      skippedCount++;
    } else {
      console.error(`❌ Error updating ${component}:`, error.message);
      errorCount++;
    }
  }
}

console.log("\n✅ Update complete!");
console.log(`Updated: ${successCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Errors: ${errorCount}`);
