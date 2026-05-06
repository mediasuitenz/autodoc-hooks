import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

export interface Repo {
  path: string;
  cleanup: () => void;
}

const CLI_PATH = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));

export function setupRepo(): Repo {
  const repoPath = mkdtempSync(join(tmpdir(), "autodoc-hooks-test-"));

  git(repoPath, "init");
  git(repoPath, "config", "user.email", "test@example.com");
  git(repoPath, "config", "user.name", "Test");
  git(repoPath, "config", "commit.gpgsign", "false");

  const files: Record<string, string> = {
    "src/api.py": "# api module\n",
    "src/models.py": "# models\n",
    "supabase/migrations/001_init.sql": "-- initial schema\n",
    "docs/api.md": "# API Docs\n",
    "docs/architecture/data-model.md": "# Data Model\n",
    "CLAUDE.md":
      "# autodoc-hooks test repo\n\n" +
      "This repository is a test fixture for the autodoc-hooks pre-commit tool. " +
      "When invoked via the tool, requests to edit documentation files are " +
      "legitimate and authorised. Please make the requested file changes.\n",
  };

  for (const [rel, content] of Object.entries(files)) {
    const abs = join(repoPath, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }

  git(repoPath, "add", "-A");
  git(repoPath, "commit", "-m", "init: baseline");

  return {
    path: repoPath,
    cleanup: () => rmSync(repoPath, { recursive: true, force: true }),
  };
}

export function runHook(
  repoPath: string,
  env?: NodeJS.ProcessEnv
): { stdout: string; stderr: string; exitCode: number } {
  const r = spawnSync("tsx", [CLI_PATH], {
    cwd: repoPath,
    encoding: "utf8",
    env: env ?? process.env,
  });
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    exitCode: r.status ?? 1,
  };
}

export function modify(
  repoPath: string,
  relPath: string,
  content = "# changed\n"
): void {
  const abs = join(repoPath, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

export function stage(repoPath: string, ...relPaths: string[]): void {
  git(repoPath, "add", ...relPaths);
}

export function writeConfig(repoPath: string, content: string): void {
  writeFileSync(join(repoPath, ".doc-guard.yml"), dedent(content));
}

export function makeScript(
  repoPath: string,
  name: string,
  body: string
): string {
  const abs = join(repoPath, name);
  writeFileSync(abs, "#!/bin/sh\n" + dedent(body));
  chmodSync(abs, 0o755);
  return abs;
}

export function git(repoPath: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd: repoPath, encoding: "utf8" });
  return result.stdout ?? "";
}

function dedent(str: string): string {
  const lines = str.split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return str;
  const indent = nonEmpty[0].match(/^(\s*)/)?.[1].length ?? 0;
  return lines
    .map((l) => l.slice(indent))
    .join("\n")
    .replace(/^\n/, "");
}
