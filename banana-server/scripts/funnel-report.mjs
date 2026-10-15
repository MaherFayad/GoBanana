/**
 * Install funnel report (DIST-08): how many users reached each step, and the drop between steps.
 * Read only. It prints counts and percentages, never a user id or an email.
 *
 *   DATABASE_URL=... node scripts/funnel-report.mjs
 *   node scripts/funnel-report.mjs --dev-vars path/to/.dev.vars     (reads DATABASE_URL from that file)
 *
 * Steps: first ping (connected), first canvas, first kept direction, first export. The table
 * (install_funnel) starts filling when migration 0008 is applied and the tools are deployed, so
 * users who stopped before that show as "no funnel row yet".
 */
import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function devVar(name, file) {
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : undefined;
}

const flag = process.argv.indexOf("--dev-vars");
const devVarsFile = resolve(flag > 0 ? process.argv[flag + 1] : join(ROOT, ".dev.vars"));
const url = process.env.DATABASE_URL || devVar("DATABASE_URL", devVarsFile);
if (!url) {
  console.error("No DATABASE_URL. Set it, or pass --dev-vars path/to/.dev.vars.");
  process.exit(1);
}

const sql = neon(url);
const [row] = await sql`
  select
    (select count(*) from users)::int as users,
    count(first_ping_at)::int as ping,
    count(first_canvas_at)::int as canvas,
    count(first_keep_at)::int as keep,
    count(first_export_at)::int as export,
    count(*)::int as rows
  from install_funnel`;

const pct = (n, of) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "-");
const steps = [
  ["Signed up (users)", row.users],
  ["First ping", row.ping],
  ["First canvas", row.canvas],
  ["First kept direction", row.keep],
  ["First export", row.export],
];
console.log("Install funnel");
steps.forEach(([label, n], i) => {
  const prev = i === 0 ? null : steps[i - 1][1];
  const fromTop = i === 0 ? "" : `  ${pct(n, row.users)} of users, ${pct(n, prev)} of the step before`;
  console.log(`${String(n).padStart(6)}  ${label}${fromTop}`);
});
console.log(`${String(row.users - row.rows).padStart(6)}  users with no funnel row yet`);
