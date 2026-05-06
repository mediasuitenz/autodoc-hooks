import { it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupRepo, runHook, modify, stage, writeConfig, type Repo } from "./helpers.js";

let repo: Repo;
beforeEach(() => { repo = setupRepo(); });
afterEach(() => repo.cleanup());

it("block exits 1 when source changed without docs", () => {
  writeConfig(repo.path, `
    version: 1
    defaults:
      on_failure: block
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("[BLOCK]");
});

it("warn exits 0 when source changed without docs", () => {
  writeConfig(repo.path, `
    version: 1
    defaults:
      on_failure: warn
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("[WARN]");
});

it("passes when source and doc both staged", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
  `);
  modify(repo.path, "src/api.py");
  modify(repo.path, "docs/api.md", "# updated\n");
  stage(repo.path, "src/api.py", "docs/api.md");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain("[BLOCK]");
  expect(stdout).not.toContain("[WARN]");
});

it("no trigger when watched files not staged", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Migration docs
        watch: [supabase/migrations/**]
        require_change_in: [docs/architecture/data-model.md]
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});

it("OR logic: any one doc change satisfies the rule", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Docs
        watch: [src/**]
        require_change_in:
          - docs/api.md
          - docs/architecture/data-model.md
  `);
  modify(repo.path, "src/api.py");
  modify(repo.path, "docs/architecture/data-model.md", "# updated\n");
  stage(repo.path, "src/api.py", "docs/architecture/data-model.md");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});

it("per-rule on_failure overrides global default", () => {
  writeConfig(repo.path, `
    version: 1
    defaults:
      on_failure: warn
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("[BLOCK]");
});

it("multiple rules: one fails → exit 1", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Migration docs
        watch: [supabase/migrations/**]
        require_change_in: [docs/architecture/data-model.md]
        on_failure: block
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
  `);
  writeFileSync(join(repo.path, "supabase/migrations/002_add_users.sql"), "-- users\n");
  modify(repo.path, "docs/architecture/data-model.md", "# updated\n");
  modify(repo.path, "src/api.py");
  stage(repo.path, "supabase/migrations/002_add_users.sql", "docs/architecture/data-model.md", "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("API docs");
});

it("multiple rules: all pass → exit 0", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Migration docs
        watch: [supabase/migrations/**]
        require_change_in: [docs/architecture/data-model.md]
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
  `);
  writeFileSync(join(repo.path, "supabase/migrations/002_add_users.sql"), "-- users\n");
  modify(repo.path, "docs/architecture/data-model.md", "# updated\n");
  modify(repo.path, "src/api.py");
  modify(repo.path, "docs/api.md", "# updated\n");
  stage(repo.path,
    "supabase/migrations/002_add_users.sql",
    "docs/architecture/data-model.md",
    "src/api.py",
    "docs/api.md"
  );

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});
