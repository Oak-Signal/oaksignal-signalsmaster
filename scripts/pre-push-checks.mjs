#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const isTTY = process.stdout.isTTY;
const useColor = isTTY && process.env.NO_COLOR !== "1";
const verbose = process.env.PUSH_CHECKS_VERBOSE === "1";
const fastMode = process.env.PUSH_CHECKS_FAST === "1";
const fullMode = process.env.PUSH_CHECKS_FULL === "1";
const noSpinner = process.env.PUSH_CHECKS_NO_SPINNER === "1" || !isTTY;

const logDir = path.join(os.tmpdir(), "signals-master-pre-push");
fs.mkdirSync(logDir, { recursive: true });

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function color(value, tone) {
  if (!useColor) return value;
  return `${C[tone] || ""}${value}${C.reset}`;
}

function nowMs() {
  return Date.now();
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function line(char = "=", width = 78) {
  return char.repeat(width);
}

function write(msg) {
  process.stdout.write(msg);
}

function println(msg = "") {
  process.stdout.write(`${msg}\n`);
}

function printHeader(title) {
  println(color(line("="), "dim"));
  println(`${color("PRE-PUSH", "bold")} ${title}`);
  println(color(line("="), "dim"));
}

function printSection(title) {
  println("");
  println(color(line("-"), "dim"));
  println(color(title, "cyan"));
  println(color(line("-"), "dim"));
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
  return result.status === 0;
}

function runSync(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: false,
    ...opts,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function writeLog(fileName, content) {
  const fullPath = path.join(logDir, fileName);
  fs.writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

function renderProgress(current, total, label) {
  const width = 24;
  const ratio = total > 0 ? current / total : 1;
  const fill = Math.round(width * ratio);
  const bar = `${"#".repeat(fill)}${".".repeat(Math.max(0, width - fill))}`;
  return `[${bar}] ${current}/${total} ${label}`;
}

async function runCommandWithSpinner(command, args, label, logPrefix) {
  const start = nowMs();
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    if (verbose) write(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    if (verbose) write(chunk.toString());
  });

  const frames = ["|", "/", "-", "\\"];
  let i = 0;
  let spinner;

  if (!noSpinner && !verbose) {
    spinner = setInterval(() => {
      const frame = frames[i % frames.length];
      i += 1;
      write(`\r${color(frame, "cyan")} ${label}...`);
    }, 100);
  } else {
    println(`${label}...`);
  }

  const code = await new Promise((resolve) => {
    child.on("close", (exitCode) => resolve(exitCode ?? 1));
  });

  if (spinner) {
    clearInterval(spinner);
    write("\r");
    write(" ".repeat(Math.max(0, label.length + 8)));
    write("\r");
  }

  const elapsed = nowMs() - start;
  const logPath = writeLog(
    `${logPrefix}-${Date.now()}.log`,
    `> ${command} ${args.join(" ")}\n\n${stdout}${stderr ? `\n${stderr}` : ""}`
  );
  return { code, stdout, stderr, elapsed, logPath };
}

function getOutgoingRange() {
  const hasOriginMain = runSync("git", ["rev-parse", "--verify", "origin/main"]).code === 0;
  return hasOriginMain ? "origin/main..HEAD" : "HEAD~1..HEAD";
}

function getCommitCount(range) {
  const result = runSync("git", ["rev-list", "--count", range]);
  if (result.code !== 0) return 0;
  const count = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(count) ? count : 0;
}

function getChangedFiles(range) {
  const result = runSync("git", ["diff", "--name-only", "--diff-filter=AM", range]);
  if (result.code !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function getDiffContent(range) {
  const result = runSync("git", ["diff", "--diff-filter=AM", range]);
  if (result.code !== 0) return "";
  return result.stdout;
}

function failWithDetails(message, details = []) {
  println(color(`[FAIL] ${message}`, "red"));
  for (const item of details) println(`  - ${item}`);
  println(`  - ${color("Skip only if necessary:", "yellow")} git push --no-verify`);
  process.exit(1);
}

function scanBasicPatterns(range) {
  const files = getChangedFiles(range);
  const diff = getDiffContent(range);
  const envFiles = files.filter((f) => /(^|\/)environment\.(ts|prod\.ts)$/i.test(f));
  if (envFiles.length > 0) {
    failWithDetails("Attempting to push environment config files.", [
      `Files: ${envFiles.join(", ")}`,
    ]);
  }

  const checks = [
    { name: "Firebase API key", regex: /AIzaSy[0-9A-Za-z_-]{33}/g },
    { name: "GitHub token", regex: /gh[ps]_[0-9A-Za-z]{36}/g },
    { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
    { name: "Private key", regex: /-----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/g },
  ];

  for (const check of checks) {
    const matches = diff.match(check.regex);
    if (matches && matches.length > 0) {
      failWithDetails(`${check.name} detected in outgoing changes.`, [
        `Matches found: ${matches.length}`,
      ]);
    }
  }
}

function printSummary(summary) {
  println("");
  println(color(line("="), "dim"));
  println(color("Summary", "bold"));
  println(`  Passed : ${color(String(summary.passed), "green")}`);
  println(`  Skipped: ${color(String(summary.skipped), "yellow")}`);
  println(`  Failed : ${color(String(summary.failed), "red")}`);
  println(`  Time   : ${formatDuration(nowMs() - summary.startedAt)}`);
  println(color(line("="), "dim"));
}

async function main() {
  const startedAt = nowMs();
  const summary = { startedAt, passed: 0, skipped: 0, failed: 0 };
  const totalSteps = 4;
  let currentStep = 0;

  printHeader("Running final security and quality checks");

  const range = getOutgoingRange();
  const commitCount = getCommitCount(range);
  println(
    `${color("[INFO]", "cyan")} Range: ${color(range, "bold")} (${commitCount} commit${commitCount === 1 ? "" : "s"})`
  );
  if (fastMode) {
    println(`${color("[WARN]", "yellow")} PUSH_CHECKS_FAST=1 enabled. Quality checks will be skipped.`);
  } else if (fullMode) {
    println(`${color("[INFO]", "cyan")} PUSH_CHECKS_FULL=1 enabled. Running full quality checks (includes build).`);
  } else {
    println(`${color("[INFO]", "cyan")} Running quick local quality checks. Set PUSH_CHECKS_FULL=1 for full checks.`);
  }

  currentStep += 1;
  printSection(renderProgress(currentStep, totalSteps, "Comprehensive gitleaks scan"));
  if (commandExists("gitleaks")) {
    const gitleaks = await runCommandWithSpinner(
      "gitleaks",
      ["detect", "--verbose", `--log-opts=${range}`],
      "Running gitleaks",
      "gitleaks"
    );
    if (gitleaks.code !== 0) {
      summary.failed += 1;
      println(color("[FAIL] Gitleaks found potential secrets.", "red"));
      println(`  - Full log: ${gitleaks.logPath}`);
      println("  - Review and remove secrets before pushing.");
      process.exit(1);
    }
    summary.passed += 1;
    println(`${color("[OK]", "green")} Gitleaks passed in ${formatDuration(gitleaks.elapsed)}`);
  } else {
    summary.skipped += 1;
    println(`${color("[SKIP]", "yellow")} gitleaks is not installed.`);
    println("  - Install with winget: winget install gitleaks");
    println("  - Install docs: https://github.com/gitleaks/gitleaks");
  }

  currentStep += 1;
  printSection(renderProgress(currentStep, totalSteps, "Basic secret pattern scan"));
  const scanStart = nowMs();
  scanBasicPatterns(range);
  summary.passed += 1;
  println(`${color("[OK]", "green")} Basic pattern scan passed in ${formatDuration(nowMs() - scanStart)}`);

  currentStep += 1;
  printSection(renderProgress(currentStep, totalSteps, "Repository quality checks"));
  if (fastMode) {
    summary.skipped += 1;
    println(`${color("[SKIP]", "yellow")} Skipped npm run check because PUSH_CHECKS_FAST=1.`);
  } else {
    const qualityScript = fullMode ? "check" : "check:quick";
    const qualityLabel = fullMode ? "npm run check" : "npm run check:quick";
    const quality = process.platform === "win32"
      ? await runCommandWithSpinner("cmd", ["/d", "/s", "/c", `npm run ${qualityScript}`], `Running ${qualityLabel}`, "npm-check")
      : await runCommandWithSpinner("npm", ["run", qualityScript], `Running ${qualityLabel}`, "npm-check");
    if (quality.code !== 0) {
      summary.failed += 1;
      println(color(`[FAIL] ${qualityLabel} failed.`, "red"));
      println(`  - Full log: ${quality.logPath}`);
      const output = `${quality.stdout}\n${quality.stderr}`.trim();
      if (output) {
        const tail = output.split(/\r?\n/).slice(-20).join("\n");
        println(color("  - Last output lines:", "yellow"));
        println(tail);
      }
      process.exit(1);
    }
    summary.passed += 1;
    println(`${color("[OK]", "green")} ${qualityLabel} passed in ${formatDuration(quality.elapsed)}`);
  }

  currentStep += 1;
  printSection(renderProgress(currentStep, totalSteps, "Finalize"));
  summary.passed += 1;
  println(`${color("[OK]", "green")} Pre-push checks completed successfully.`);

  printSummary(summary);
}

main().catch((error) => {
  println(color("[FAIL] Unexpected pre-push error.", "red"));
  println(String(error?.stack || error));
  process.exit(1);
});
