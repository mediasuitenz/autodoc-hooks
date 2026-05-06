#!/usr/bin/env node
import { unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadConfig, type Rule } from "./config.js";
import { getStagedFiles, getPushFiles } from "./git.js";
import { anyFileMatches } from "./matcher.js";
import { runResolver } from "./resolver.js";

// When the user Ctrl+C's during on_resolve, git commit dies but doesn't clean
// up its own index lock. Remove it so subsequent git commands aren't blocked.
function removeGitLock(): void {
  const gitDir = spawnSync("git", ["rev-parse", "--git-dir"], {
    encoding: "utf8",
  }).stdout?.trim();
  if (!gitDir) return;
  try {
    unlinkSync(`${gitDir}/index.lock`);
  } catch {
    // didn't exist — no-op
  }
}

process.on("SIGINT", () => {
  removeGitLock();
  process.exit(130);
});
process.on("SIGTERM", () => {
  removeGitLock();
  process.exit(143);
});

function changedFiles(scope: string): string[] {
  return scope === "push" ? getPushFiles() : getStagedFiles();
}

function missingDocs(rule: Rule, changed: string[]): string[] {
  if (!anyFileMatches(changed, rule.watch)) return [];
  if (anyFileMatches(changed, rule.requireChangeIn)) return [];
  return rule.requireChangeIn;
}

function substitute(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{changed_files\}/g, vars.changed_files ?? "")
    .replace(/\{missing_docs\}/g, vars.missing_docs ?? "")
    .replace(/\{rule_name\}/g, vars.rule_name ?? "");
}

function warnUnknownVars(template: string): void {
  const known = new Set(["changed_files", "missing_docs", "rule_name"]);
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    if (!known.has(match[1])) {
      console.warn(
        `  [autodoc-hooks] Warning: unknown template variable '{${match[1]}}' in prompt/run — it will not be substituted`
      );
    }
  }
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");

  let config;
  try {
    config = loadConfig();
  } catch {
    process.exit(0);
  }

  let exitCode = 0;

  for (const rule of config.rules) {
    const changed = changedFiles(rule.scope);
    const missing = missingDocs(rule, changed);

    if (missing.length === 0) continue;

    console.log(`\n[autodoc-hooks] Rule '${rule.name}' triggered`);
    console.log(`  Source changes in: ${rule.watch.join(", ")}`);
    console.log(`  No doc changes in: ${missing.join(", ")}`);

    if (dryRun && rule.onResolve) {
      const vars = {
        changed_files: changed.join(" "),
        missing_docs: missing.join(" "),
        rule_name: rule.name,
      };
      const field = rule.onResolve.type === "claude" ? "prompt" : "run";
      const template =
        rule.onResolve.type === "claude"
          ? rule.onResolve.prompt
          : rule.onResolve.run;
      warnUnknownVars(template);
      console.log(`  [dry-run] on_resolve ${field}:`);
      console.log(`    ${substitute(template, vars)}`);
      continue;
    }

    if (rule.onResolve) {
      const template =
        rule.onResolve.type === "claude"
          ? rule.onResolve.prompt
          : rule.onResolve.run;
      warnUnknownVars(template);
      console.log(`  Running auto-resolve (${rule.onResolve.type})...`);
      const success = runResolver(rule.onResolve, changed, missing, rule.name);

      if (success) {
        const recheck = changedFiles(rule.scope);
        if (missingDocs(rule, recheck).length === 0) {
          console.log("  Resolved: docs updated and staged.");
          continue;
        }
        console.log("  Auto-resolve ran but docs still not updated.");
      } else {
        console.log("  Auto-resolve failed.");
      }
    }

    if (rule.onFailure === "warn") {
      console.log("  [WARN] Proceeding without doc update.");
    } else {
      console.log(
        "  [BLOCK] Commit blocked. Update the listed docs or set on_failure: warn."
      );
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}

main();
