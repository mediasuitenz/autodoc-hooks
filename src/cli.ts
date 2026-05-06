#!/usr/bin/env node
import { loadConfig, type Rule } from "./config.js";
import { getStagedFiles, getPushFiles } from "./git.js";
import { anyFileMatches } from "./matcher.js";
import { runResolver } from "./resolver.js";

function changedFiles(scope: string): string[] {
  return scope === "push" ? getPushFiles() : getStagedFiles();
}

function missingDocs(rule: Rule, changed: string[]): string[] {
  if (!anyFileMatches(changed, rule.watch)) return [];
  if (anyFileMatches(changed, rule.requireChangeIn)) return [];
  return rule.requireChangeIn;
}

function main(): void {
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

    if (rule.onResolve) {
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
