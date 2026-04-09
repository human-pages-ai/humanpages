/**
 * Watch Dog Auto-Fix — Self-healing via Claude Code CLI
 *
 * Three-tier pipeline:
 *   1. Diagnosis: Claude reads source code + error context, proposes a fix (diff)
 *   2. Application: Create branch, apply diff, run tsc + tests
 *   3. Approval: FATAL → Telegram approval gate; ERROR → auto-merge if tests pass
 *
 * Uses `claude -p` (print mode) for headless operation — same pattern as
 * scripts/should-run-e2e.mjs which already runs Claude CLI in CI.
 */
import { spawnSync, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { prisma } from './prisma.js';
import { sendTelegramMessage } from './telegram.js';
import { acquireQuota } from './error-monitor.js';
import { logger } from './logger.js';
import type { ErrorGroup, LogLine } from './error-monitor.js';

// ── Types ──────────────────────────────────────────────────────────

export interface AutoFixProposal {
  rootCause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles: string[];
  proposedFix: string; // unified diff
  reasoning: string;
  estimatedRisk: string;
}

export interface AutoFixResult {
  status: 'proposed' | 'staged' | 'failed';
  proposal?: AutoFixProposal;
  branchName?: string;
  testOutput?: string;
  error?: string;
}

// ── Configuration ──────────────────────────────────────────────────

const AUTOFIX_CONFIG = {
  MAX_ATTEMPTS_PER_HOUR: 5,
  CLAUDE_TIMEOUT_MS: 120_000, // 2 minutes — needs time to reason about code
  MAX_SOURCE_LINES_PER_FILE: 500,
  MAX_SOURCE_FILES: 3,
  MODEL: 'sonnet',
};

// ── Rate limiting for auto-fix attempts ────────────────────────────

let fixAttempts = { count: 0, resetAt: 0 };

function acquireFixQuota(): boolean {
  const now = Date.now();
  if (now > fixAttempts.resetAt) {
    fixAttempts = { count: 0, resetAt: now + 3600_000 };
  }
  if (fixAttempts.count < AUTOFIX_CONFIG.MAX_ATTEMPTS_PER_HOUR) {
    fixAttempts.count++;
    return true;
  }
  return false;
}

// ── Helpers ────────────────────────────────────────────────────────

function getProjectRoot(): string {
  // Walk up from backend/src/lib to find project root
  let dir = path.resolve(__dirname, '..', '..', '..');
  // Fallback: check for package.json
  if (!existsSync(path.join(dir, 'package.json'))) {
    dir = process.cwd();
  }
  return dir;
}

/**
 * Extract file paths from a stack trace.
 * Matches patterns like: at functionName (/path/to/file.ts:42:10)
 * or: /path/to/file.ts:42:10
 */
export function extractFilePathsFromStack(sample: LogLine): string[] {
  const stack = sample.err?.stack || '';
  const projectRoot = getProjectRoot();

  const filePattern = /(?:at\s+.+\s+\()?([/\w._-]+\.(ts|js|mjs)):(\d+):\d+\)?/g;
  const files = new Set<string>();

  let match;
  while ((match = filePattern.exec(stack)) !== null) {
    let filePath = match[1];

    // Skip node_modules and node internals
    if (filePath.includes('node_modules') || filePath.startsWith('node:')) continue;

    // Resolve relative to project
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(projectRoot, filePath);
    }

    // Only include files that actually exist
    if (existsSync(filePath)) {
      files.add(filePath);
    }

    if (files.size >= AUTOFIX_CONFIG.MAX_SOURCE_FILES) break;
  }

  return Array.from(files);
}

/**
 * Read source files and format them as context for Claude.
 * Truncates each file to MAX_SOURCE_LINES_PER_FILE.
 */
export function readSourceForContext(filePaths: string[], maxLinesPerFile = AUTOFIX_CONFIG.MAX_SOURCE_LINES_PER_FILE): string {
  const sections: string[] = [];
  const projectRoot = getProjectRoot();

  for (const filePath of filePaths) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const truncated = lines.length > maxLinesPerFile;
      const displayLines = truncated ? lines.slice(0, maxLinesPerFile) : lines;
      const relativePath = path.relative(projectRoot, filePath);

      sections.push(
        `--- ${relativePath} (${lines.length} lines${truncated ? ', truncated' : ''}) ---\n` +
        displayLines.map((line, i) => `${i + 1}: ${line}`).join('\n')
      );
    } catch {
      // File might not be readable; skip
    }
  }

  return sections.join('\n\n');
}

/**
 * Sanitize source code to remove potential secrets before sending to Claude.
 */
function sanitizeSource(content: string): string {
  return content
    // Remove env var values
    .replace(/(API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)s?\s*[=:]\s*['"`][^'"`\n]+['"`]/gi, '$1=<REDACTED>')
    // Remove Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer <REDACTED>')
    // Remove URLs with auth tokens
    .replace(/(https?:\/\/[^?\s]+)\?[^\s]*(key|token|secret)[^\s]*/gi, '$1?<REDACTED>');
}

/**
 * Call Claude Code CLI in print mode (headless, non-interactive).
 * Returns the CLI output or null on failure.
 */
export function callClaudeCLI(prompt: string, timeoutMs = AUTOFIX_CONFIG.CLAUDE_TIMEOUT_MS): string | null {
  try {
    const result = spawnSync('claude', ['-p', '--model', AUTOFIX_CONFIG.MODEL], {
      input: prompt,
      encoding: 'utf8',
      timeout: timeoutMs,
      cwd: getProjectRoot(),
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (result.status !== 0 || !result.stdout) {
      logger.error(
        { exitCode: result.status, stderr: result.stderr?.slice(0, 500) },
        'Watch Dog Auto-Fix: Claude CLI failed',
      );
      return null;
    }

    return result.stdout;
  } catch (err) {
    logger.error({ err }, 'Watch Dog Auto-Fix: Claude CLI error');
    return null;
  }
}

/**
 * Run a git command through the git-safe.sh mutex wrapper.
 */
function runGitSafe(...args: string[]): { exitCode: number; stdout: string; stderr: string } {
  try {
    const scriptPath = path.join(getProjectRoot(), 'scripts', 'git-safe.sh');
    const result = spawnSync('sh', [scriptPath, ...args], {
      encoding: 'utf8',
      timeout: 60_000,
      cwd: getProjectRoot(),
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  } catch (err: any) {
    return { exitCode: 1, stdout: '', stderr: err.message };
  }
}

/**
 * Run a shell command and return its output.
 */
function runCommand(command: string, timeoutMs = 120_000): { exitCode: number; stdout: string; stderr: string } {
  try {
    const result = spawnSync('sh', ['-c', command], {
      encoding: 'utf8',
      timeout: timeoutMs,
      cwd: path.join(getProjectRoot(), 'backend'),
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  } catch (err: any) {
    return { exitCode: 1, stdout: '', stderr: err.message };
  }
}

// ── Tier 1: Diagnosis ──────────────────────────────────────────────

/**
 * Use Claude Code CLI to analyze the error and propose a fix.
 * Returns a structured proposal with a unified diff.
 */
export async function proposeAutoFix(group: ErrorGroup): Promise<AutoFixProposal | null> {
  if (!acquireFixQuota()) {
    logger.info('Watch Dog Auto-Fix: Fix budget exhausted, skipping');
    return null;
  }

  if (!acquireQuota('claude')) {
    logger.info('Watch Dog Auto-Fix: Claude budget exhausted, skipping');
    return null;
  }

  // Extract file paths from stack trace
  const sample = group.samples[0];
  if (!sample) return null;

  const filePaths = extractFilePathsFromStack(sample);
  const sourceContext = filePaths.length > 0
    ? sanitizeSource(readSourceForContext(filePaths))
    : '(no source files found in stack trace)';

  const prompt = `You are a senior backend engineer diagnosing and fixing a production error.

## Error Details
- **Type**: ${group.errorType || 'unknown'}
- **Message**: ${group.message}
- **Category**: ${group.category}
- **Occurrences**: ${group.count}
- **Level**: ${group.level >= 60 ? 'FATAL' : 'ERROR'}

## Stack Trace
${sample.err?.stack || '(no stack trace available)'}

## Relevant Source Code
${sourceContext}

## Sample Log Entry
${JSON.stringify(sample, null, 2).slice(0, 2000)}

## Instructions
1. Analyze the root cause of this error
2. Determine the severity and risk
3. Propose a fix as a unified diff (git apply compatible)
4. Explain your reasoning

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "rootCause": "one sentence explaining the root cause",
  "severity": "low|medium|high|critical",
  "affectedFiles": ["relative/path/to/file.ts"],
  "proposedFix": "unified diff here (--- a/file\\n+++ b/file\\n@@ ... @@\\n...)",
  "reasoning": "why this fix is correct and safe",
  "estimatedRisk": "brief assessment of risk of this fix"
}

IMPORTANT:
- The diff must be a valid unified diff that \`git apply\` can handle
- Use relative paths from the project root (e.g., backend/src/lib/foo.ts)
- If the error cannot be fixed with a code change (e.g., infrastructure issue, config problem), set severity to "critical" and explain in reasoning
- Do NOT propose changes to test files, migrations, or config files`;

  const output = callClaudeCLI(prompt);
  if (!output) return null;

  return parseProposal(output);
}

/**
 * Parse Claude's JSON response into an AutoFixProposal.
 */
function parseProposal(raw: string): AutoFixProposal | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.rootCause || !parsed.severity || !parsed.proposedFix) {
      logger.warn({ parsed }, 'Watch Dog Auto-Fix: Incomplete proposal from Claude');
      return null;
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(parsed.severity)) {
      parsed.severity = 'medium';
    }

    return {
      rootCause: String(parsed.rootCause).slice(0, 500),
      severity: parsed.severity,
      affectedFiles: Array.isArray(parsed.affectedFiles) ? parsed.affectedFiles : [],
      proposedFix: String(parsed.proposedFix),
      reasoning: String(parsed.reasoning || '').slice(0, 1000),
      estimatedRisk: String(parsed.estimatedRisk || 'unknown').slice(0, 500),
    };
  } catch (err) {
    logger.error({ err, rawLength: raw.length }, 'Watch Dog Auto-Fix: Failed to parse Claude proposal');
    return null;
  }
}

// ── Tier 2: Safe Application ────────────────────────────────────────

/**
 * Apply a proposed fix on a git branch, run tests, and stage it.
 */
export async function applyAutoFix(
  monitoredErrorId: string,
  proposal: AutoFixProposal,
): Promise<AutoFixResult> {
  const fingerprint = monitoredErrorId.slice(0, 8);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const branchName = `session/${timestamp}-fix-${fingerprint}`;
  const projectRoot = getProjectRoot();
  const patchFile = `/tmp/watchdog-fix-${fingerprint}.patch`;

  try {
    // Update status to applying
    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: {
        autoFixStatus: 'applying',
        autoFixProposal: proposal.proposedFix,
        autoFixAttemptedAt: new Date(),
      },
    });

    // Save current branch to return to later
    const currentBranch = runGitSafe('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

    // Create session branch
    const fetchResult = runGitSafe('fetch', 'origin', 'master');
    if (fetchResult.exitCode !== 0) {
      return { status: 'failed', error: `Git fetch failed: ${fetchResult.stderr}` };
    }

    const branchResult = runGitSafe('checkout', '-b', branchName, 'origin/master');
    if (branchResult.exitCode !== 0) {
      return { status: 'failed', error: `Branch creation failed: ${branchResult.stderr}` };
    }

    // Write the diff to a temp file
    writeFileSync(patchFile, proposal.proposedFix, 'utf-8');

    // Dry-run the patch first
    const dryRun = runCommand(`cd ${projectRoot} && git apply --check ${patchFile}`);
    if (dryRun.exitCode !== 0) {
      // Cleanup: return to original branch
      runGitSafe('checkout', currentBranch);
      runGitSafe('branch', '-D', branchName);

      await prisma.monitoredError.update({
        where: { id: monitoredErrorId },
        data: {
          autoFixStatus: 'failed',
          autoFixTestOutput: `Patch dry-run failed:\n${dryRun.stderr}`,
        },
      });
      return { status: 'failed', error: 'Patch does not apply cleanly', testOutput: dryRun.stderr };
    }

    // Apply the patch
    const applyResult = runCommand(`cd ${projectRoot} && git apply ${patchFile}`);
    if (applyResult.exitCode !== 0) {
      runGitSafe('checkout', currentBranch);
      runGitSafe('branch', '-D', branchName);

      await prisma.monitoredError.update({
        where: { id: monitoredErrorId },
        data: { autoFixStatus: 'failed', autoFixTestOutput: `Patch apply failed:\n${applyResult.stderr}` },
      });
      return { status: 'failed', error: 'Failed to apply patch', testOutput: applyResult.stderr };
    }

    // Update status to testing
    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: { autoFixStatus: 'testing' },
    });

    // Regenerate Prisma client (in case schema was affected, though we don't expect it)
    runCommand('PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate 2>/dev/null || true');

    // Run TypeScript check
    const tscResult = runCommand('npx tsc --noEmit', 180_000);
    if (tscResult.exitCode !== 0) {
      const output = `TypeScript check failed:\n${tscResult.stdout}\n${tscResult.stderr}`;

      // Cleanup: reset changes, return to original branch
      runCommand(`cd ${projectRoot} && git checkout -- .`);
      runGitSafe('checkout', currentBranch);
      runGitSafe('branch', '-D', branchName);

      await prisma.monitoredError.update({
        where: { id: monitoredErrorId },
        data: { autoFixStatus: 'failed', autoFixTestOutput: output.slice(0, 10000) },
      });
      return { status: 'failed', error: 'TypeScript check failed', testOutput: output };
    }

    // Run unit tests
    const testResult = runCommand('npm test', 180_000);
    if (testResult.exitCode !== 0) {
      const output = `Unit tests failed:\n${testResult.stdout}\n${testResult.stderr}`;

      runCommand(`cd ${projectRoot} && git checkout -- .`);
      runGitSafe('checkout', currentBranch);
      runGitSafe('branch', '-D', branchName);

      await prisma.monitoredError.update({
        where: { id: monitoredErrorId },
        data: { autoFixStatus: 'failed', autoFixTestOutput: output.slice(0, 10000) },
      });
      return { status: 'failed', error: 'Unit tests failed', testOutput: output };
    }

    // Stage, commit, and update DB
    runGitSafe('add', '-A');
    runGitSafe('commit', '-m', `Auto-fix: ${proposal.rootCause.slice(0, 72)}`);

    // Return to original branch
    runGitSafe('checkout', currentBranch);

    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: {
        autoFixStatus: 'staged',
        autoFixBranch: branchName,
        autoFixTestOutput: 'TypeScript ✓ | Unit tests ✓',
      },
    });

    return {
      status: 'staged',
      proposal,
      branchName,
      testOutput: 'TypeScript ✓ | Unit tests ✓',
    };
  } catch (err: any) {
    logger.error({ err, monitoredErrorId }, 'Watch Dog Auto-Fix: Unexpected error during apply');

    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: { autoFixStatus: 'failed', autoFixTestOutput: err.message?.slice(0, 5000) },
    }).catch((dbErr: unknown) => {
      logger.error({ err: dbErr, monitoredErrorId }, 'Failed to record autofix failure status in DB');
    });

    return { status: 'failed', error: err.message };
  } finally {
    // Cleanup temp patch file
    try { unlinkSync(patchFile); } catch { /* ignore */ }
  }
}

// ── Tier 3: Approval + Merge ────────────────────────────────────────

/**
 * Merge a staged fix branch to master and restart PM2.
 */
export async function approveAndMergeFix(
  monitoredErrorId: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const error = await prisma.monitoredError.findUnique({ where: { id: monitoredErrorId } });
  if (!error?.autoFixBranch) {
    return { success: false, error: 'No staged fix branch for this error' };
  }

  if (error.autoFixStatus !== 'staged') {
    return { success: false, error: `Fix is not staged (current status: ${error.autoFixStatus})` };
  }

  const projectRoot = getProjectRoot();

  try {
    // Mark as approved
    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: { autoFixStatus: 'approved' },
    });

    // Checkout the fix branch
    const checkoutResult = runGitSafe('checkout', error.autoFixBranch);
    if (checkoutResult.exitCode !== 0) {
      return { success: false, error: `Checkout failed: ${checkoutResult.stderr}` };
    }

    // Use git-session-merge.sh to merge + push
    const mergeScript = path.join(projectRoot, 'scripts', 'git-session-merge.sh');
    const mergeResult = runCommand(
      `cd ${projectRoot} && ALLOW_MASTER_COMMIT=1 sh ${mergeScript} "Auto-fix: ${error.message.slice(0, 60)}"`,
      120_000,
    );

    if (mergeResult.exitCode !== 0) {
      await prisma.monitoredError.update({
        where: { id: monitoredErrorId },
        data: { autoFixStatus: 'failed', autoFixTestOutput: `Merge failed:\n${mergeResult.stderr}` },
      });
      return { success: false, error: `Merge failed: ${mergeResult.stderr}` };
    }

    // Restart PM2 to apply the fix
    const restartResult = runCommand(`cd ${projectRoot} && pm2 restart human-pages 2>&1 || true`, 30_000);

    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: {
        autoFixStatus: 'merged',
        autoFixMergedAt: new Date(),
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });

    // Notify via Telegram
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId) {
      const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
      await sendTelegramMessage({
        chatId,
        text: [
          '\u{2705} <b>Watch Dog: Auto-fix merged & deployed</b>',
          '',
          `<b>Error:</b> ${escapeHtml(error.message.slice(0, 200))}`,
          `<b>Root cause:</b> ${escapeHtml(error.autoFixProposal?.slice(0, 200) || '(see dashboard)')}`,
          `<b>Branch:</b> ${error.autoFixBranch}`,
          '',
          `PM2 restart: ${restartResult.exitCode === 0 ? 'OK' : 'manual restart may be needed'}`,
          appUrl ? `\n<a href="${appUrl}/admin/watchdog">View in Dashboard</a>` : '',
        ].join('\n'),
        parseMode: 'HTML',
      });
    }

    return {
      success: true,
      output: mergeResult.stdout,
    };
  } catch (err: any) {
    logger.error({ err, monitoredErrorId }, 'Watch Dog Auto-Fix: Merge failed');
    return { success: false, error: err.message };
  }
}

/**
 * Reject a staged fix and clean up the branch.
 */
export async function rejectFix(
  monitoredErrorId: string,
): Promise<{ success: boolean; error?: string }> {
  const error = await prisma.monitoredError.findUnique({ where: { id: monitoredErrorId } });
  if (!error?.autoFixBranch) {
    return { success: false, error: 'No staged fix branch for this error' };
  }

  try {
    // Delete the branch
    runGitSafe('branch', '-D', error.autoFixBranch);

    await prisma.monitoredError.update({
      where: { id: monitoredErrorId },
      data: { autoFixStatus: 'rejected' },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Send a Telegram message asking for approval of a staged fix.
 */
export async function sendFixApprovalTelegram(
  monitoredErrorId: string,
  proposal: AutoFixProposal,
): Promise<void> {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return;

  const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

  await sendTelegramMessage({
    chatId,
    text: [
      '\u{1F527} <b>Watch Dog: Auto-fix staged — needs approval</b>',
      '',
      `<b>Root cause:</b> ${escapeHtml(proposal.rootCause)}`,
      `<b>Severity:</b> ${proposal.severity}`,
      `<b>Risk:</b> ${escapeHtml(proposal.estimatedRisk)}`,
      `<b>Files:</b> ${proposal.affectedFiles.join(', ') || '(unknown)'}`,
      '',
      `<b>Tests:</b> TypeScript \u{2713} | Unit tests \u{2713}`,
      '',
      `<pre>${escapeHtml(proposal.proposedFix.slice(0, 800))}</pre>`,
      '',
      appUrl ? `<a href="${appUrl}/admin/watchdog">Approve in Dashboard</a>` : 'Approve via admin dashboard',
    ].join('\n'),
    parseMode: 'HTML',
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Check if auto-fix should be attempted for this error group.
 */
export function shouldAttemptAutoFix(group: ErrorGroup): boolean {
  // Only attempt for errors with stack traces (we need file paths)
  const hasStack = group.samples.some(s => s.err?.stack && s.err.stack.length > 50);
  if (!hasStack) return false;

  // Skip infrastructure/config errors that can't be fixed with code changes
  if (group.category === 'network' || group.category === 'memory') return false;

  return true;
}
