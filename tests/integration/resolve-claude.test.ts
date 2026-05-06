/**
 * Evals for on_resolve: type: claude.
 *
 * Requires the claude CLI to be installed and configured.
 * Tests are skipped automatically when claude is not on $PATH.
 */
import { it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { setupRepo, runHook, modify, stage, writeConfig, git, type Repo } from "./helpers.js";

const claudeAvailable = spawnSync("which", ["claude"]).status === 0;

// Single-line prompt — no embedded newlines so it embeds cleanly in YAML.
// Plain user-like request; avoids "I am a tool" framing that triggers
// claude's injection-detection heuristics.
const PROMPT =
  "The file {changed_files} was just modified. " +
  "Please edit {missing_docs} and append this line at the end: " +
  "<!-- updated after changes to {changed_files} -->";

let repo: Repo;
beforeEach(() => { repo = setupRepo(); });
afterEach(() => repo.cleanup());

it.skipIf(!claudeAvailable)("claude updates doc file and hook passes", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
        on_resolve:
          type: claude
          prompt: "${PROMPT}"
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout, stderr } = runHook(repo.path);
  expect(exitCode, `stdout:\n${stdout}\nstderr:\n${stderr}`).toBe(0);
  expect(stdout).toContain("Resolved");

  const docContent = readFileSync(join(repo.path, "docs/api.md"), "utf8");
  expect(docContent).not.toBe("# API Docs\n");
});

it.skipIf(!claudeAvailable)("stage_after: true auto-stages the doc file", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
        on_resolve:
          type: claude
          prompt: "${PROMPT}"
          stage_after: true
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);

  const staged = git(repo.path, "diff", "--cached", "--name-only").split("\n").filter(Boolean);
  expect(staged).toContain("docs/api.md");
});

it.skipIf(!claudeAvailable)("stage_after: false — doc written but not staged → block", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
        on_resolve:
          type: claude
          prompt: "${PROMPT}"
          stage_after: false
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("[BLOCK]");

  const staged = git(repo.path, "diff", "--cached", "--name-only").split("\n").filter(Boolean);
  expect(staged).not.toContain("docs/api.md");
});

it.skipIf(!claudeAvailable)("template vars are substituted before reaching claude", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Data model
        watch: [supabase/migrations/**]
        require_change_in: [docs/architecture/data-model.md]
        on_failure: block
        on_resolve:
          type: claude
          prompt: "${PROMPT}"
  `);
  writeFileSync(join(repo.path, "supabase/migrations/002_users.sql"), "-- users\n");
  stage(repo.path, "supabase/migrations/002_users.sql");

  const { exitCode, stdout, stderr } = runHook(repo.path);
  expect(exitCode, `stdout:\n${stdout}\nstderr:\n${stderr}`).toBe(0);

  const doc = readFileSync(join(repo.path, "docs/architecture/data-model.md"), "utf8");
  expect(doc).not.toBe("# Data Model\n");
});
