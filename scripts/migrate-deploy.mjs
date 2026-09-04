/**
 * Applies pending Prisma migrations before the app is built.
 *
 * Twice now a Vercel deploy has shipped code that referenced a column the
 * production database didn't have yet (`Order.driverId`, then
 * `Order.amountPaid`), because the migration was a manual step that is easy to
 * forget. Running it as part of the build ties the two together: the schema
 * always moves with the code that needs it.
 *
 * Two Neon-specific details this handles, both of which have bitten us:
 *
 *  1. Migrations must not run over the connection *pooler*. Prisma takes a
 *     Postgres advisory lock to stop two deploys migrating at once, and the
 *     pooler doesn't hold that lock across statements. Neon's direct endpoint is
 *     the same host without the `-pooler` suffix, so we derive it rather than
 *     depending on someone remembering to set a second env var.
 *  2. `DIRECT_URL` wins if it is set, for anyone who prefers to be explicit.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
// @next/env is CommonJS, so it has no named ESM exports — import the default.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!raw) {
  console.error("[migrate] No DATABASE_URL (or DIRECT_URL) set — cannot apply migrations.");
  process.exit(1);
}

/** Neon's pooled host is the direct host plus a `-pooler` suffix. */
function toDirectUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("-pooler")) return url;
    parsed.hostname = parsed.hostname.replace("-pooler", "");
    return parsed.toString();
  } catch {
    // Not a URL we can parse — hand it to Prisma unchanged and let it complain.
    return url;
  }
}

const url = toDirectUrl(raw);
if (url !== raw) {
  console.log("[migrate] Using the direct (non-pooled) endpoint for migrations.");
}

// Run Prisma's CLI entry point under the current Node binary rather than going
// through `npx`. Node refuses to spawn the Windows `.cmd` shim without a shell,
// and routing args through a shell is deprecated — this works identically on
// Windows and on Vercel's Linux builders.
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

try {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
} catch {
  // Deliberately fatal: shipping the app against a schema it doesn't match is
  // exactly the failure this script exists to prevent, so fail the build loudly
  // instead of deploying something that will 500 on first use.
  console.error("[migrate] Migration failed — aborting the build.");
  process.exit(1);
}
