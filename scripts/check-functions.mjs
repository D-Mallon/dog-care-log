import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

/**
 * Parse-check every Supabase Edge Function with esbuild.
 *
 * This is not a Deno typecheck, but it catches syntax errors and broken imports
 * that would otherwise only surface during `supabase functions deploy`.
 */
const functionsRoot = join(process.cwd(), "supabase", "functions");
const entries = (await readdir(functionsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => join(functionsRoot, entry.name, "index.ts"));

if (entries.length === 0) {
  console.error("No Edge Function entry points found.");
  process.exit(1);
}

let failed = false;

for (const entry of entries) {
  try {
    await build({
      entryPoints: [entry],
      bundle: false,
      write: false,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      logLevel: "silent",
    });
    console.log(`ok ${entry.replace(`${process.cwd()}/`, "")}`);
  } catch (error) {
    failed = true;
    console.error(`failed ${entry}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed) process.exit(1);
