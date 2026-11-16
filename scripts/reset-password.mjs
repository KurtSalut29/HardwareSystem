/**
 * Sets a new password for one account, for when it has been forgotten.
 * Passwords are stored hashed, so nobody (not even the admin) can read the old one.
 *
 * Usage (Command Prompt, inside the project folder):
 *
 *   node scripts/reset-password.mjs admin
 *
 * It works on the database in DATABASE_URL. To reset an account on the
 * deployed (online) system, set that variable to the online database first,
 * in the same Command Prompt window:
 *
 *   set DATABASE_URL=postgresql://...the online database URL...
 *   node scripts/reset-password.mjs admin
 *
 * The script shows which database it is about to change and asks you to
 * confirm before saving anything.
 */
import readline from "node:readline";
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const who = (process.argv[2] ?? "").trim();
if (!who) {
  console.log("Usage: node scripts/reset-password.mjs <username or email>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Same rule as the sign-up form.
function passwordProblem(p) {
  if (p.length > 128) return "Password is too long (128 characters at most).";
  const missing = [];
  if (p.length < 8) missing.push("at least 8 characters");
  if (!/[A-Za-z]/.test(p)) missing.push("a letter");
  if (!/\d/.test(p)) missing.push("a number");
  return missing.length ? `Password needs ${missing.join(", ")}.` : null;
}

// One reader for every question. While `muted`, what is typed isn't echoed (passwords).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
let muted = false;
const write = rl._writeToOutput?.bind(rl);
if (write) rl._writeToOutput = (s) => { if (!muted) write(s); };
const lines = [];
let waiting = null;
rl.on("line", (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else lines.push(l); });
rl.on("close", () => { if (waiting) { console.log("\nNothing was changed."); process.exit(1); } });

function ask(question, hidden = false) {
  muted = hidden;
  process.stdout.write(question);
  return new Promise((resolve) => {
    const done = (answer) => { if (hidden) process.stdout.write("\n"); muted = false; resolve(answer); };
    if (lines.length) done(lines.shift()); else waiting = done;
  });
}

const prisma = new PrismaClient();
try {
  const host = new URL(process.env.DATABASE_URL).hostname;
  const user = who.includes("@")
    ? await prisma.user.findUnique({ where: { email: who.toLowerCase() } })
    : await prisma.user.findUnique({ where: { username: who } });
  if (!user) {
    console.error(`No account "${who}" in the database at ${host}.`);
    process.exit(1);
  }

  console.log(`\nDatabase: ${host}${host === "localhost" ? "  (this laptop)" : "  (online)"}`);
  console.log(`Account:  ${user.username}${user.email ? ` <${user.email}>` : ""} — ${user.role === "cashier" ? "staff" : user.role}\n`);

  let password = "";
  for (;;) {
    password = await ask("New password: ", true);
    const problem = passwordProblem(password);
    if (problem) { console.log(problem); continue; }
    const again = await ask("Type it again: ", true);
    if (again !== password) { console.log("The two passwords don't match. Try again."); continue; }
    break;
  }

  const ok = await ask(`Save the new password for ${user.username} on ${host}? Type YES to confirm: `);
  if (ok.trim() !== "YES") {
    console.log("Nothing was changed.");
    process.exit(0);
  }
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 10) } });
  console.log(`\nDone. ${user.username} can now log in with the new password.`);
} finally {
  rl.close();
  await prisma.$disconnect();
}
