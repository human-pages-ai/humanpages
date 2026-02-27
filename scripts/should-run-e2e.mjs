#!/usr/bin/env node
/**
 * LLM escalation for pre-push hook.
 *
 * Called when the diff is 500+ lines but no heavy file patterns matched.
 * Uses Claude CLI (Max subscription, haiku model) to decide whether
 * end-to-end tests are warranted.
 *
 * Exit code 0 = run e2e (heavy)
 * Exit code 1 = skip e2e (lite)
 */

import { execSync } from "node:child_process";
import { spawnSync } from "node:child_process";

const upstream = process.argv[2] || "HEAD~1";

// Get the diff --stat summary (file list + insertions/deletions)
let stat;
try {
  stat = execSync(`git diff --stat ${upstream} HEAD`, { encoding: "utf8" });
} catch {
  console.error("  could not get diff stat, defaulting to lite");
  process.exit(1);
}

const prompt = `You are a CI gatekeeper deciding whether end-to-end browser tests should run for this push.

Answer ONLY "yes" or "no" — nothing else.

Say "yes" if the changes could affect:
- HTTP API behavior (request/response shapes, status codes, auth, middleware)
- Database schema or queries
- Frontend pages that e2e tests cover (login, dashboard, profile, welcome)
- Integration between frontend and backend

Say "no" if the changes are:
- Documentation, comments, or README updates
- Styling / CSS-only changes
- Test file changes (unit tests, test utilities)
- Build config, CI config, or tooling scripts
- Refactoring with no behavioral change (renames, type-only changes)
- Adding new files that are not wired into routes or pages yet

Git diff --stat:
${stat}`;

try {
  const result = spawnSync("claude", ["-p", "--model", "haiku"], {
    input: prompt,
    encoding: "utf8",
    timeout: 30_000,
  });

  const output = (result.stdout || "").trim().toLowerCase();

  if (result.status !== 0 || !output) {
    console.error("  LLM returned no output or errored, defaulting to lite");
    process.exit(1);
  }

  if (output.includes("yes")) {
    process.exit(0); // heavy
  } else {
    process.exit(1); // lite
  }
} catch (e) {
  // If LLM call fails for any reason, default to lite (fail open)
  console.error("  LLM escalation failed, defaulting to lite:", e.message);
  process.exit(1);
}
