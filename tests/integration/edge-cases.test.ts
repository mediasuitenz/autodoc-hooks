import { it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupRepo, runHook, modify, stage, writeConfig, type Repo } from "./helpers.js";

let repo: Repo;
beforeEach(() => { repo = setupRepo(); });
afterEach(() => repo.cleanup());

it("no config file → exits 0 silently", () => {
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(0);
  expect(stdout.trim()).toBe("");
});

it("nothing staged → exits 0", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
  `);
  modify(repo.path, "src/api.py"); // not staged

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});

it("empty rules list → exits 0", () => {
  writeConfig(repo.path, `
    version: 1
    rules: []
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});

it("new (untracked) file in watch glob triggers rule", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Migration docs
        watch: [supabase/migrations/**]
        require_change_in: [docs/architecture/data-model.md]
        on_failure: block
  `);
  writeFileSync(join(repo.path, "supabase/migrations/002_add_users.sql"), "-- users\n");
  stage(repo.path, "supabase/migrations/002_add_users.sql");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("Migration docs");
});

it("staging a watched file alongside an unrelated file still triggers", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
  `);
  modify(repo.path, "src/api.py");
  writeFileSync(join(repo.path, "supabase/migrations/999_misc.sql"), "-- misc\n");
  stage(repo.path, "src/api.py", "supabase/migrations/999_misc.sql");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(1);
});

it("staging only an unrelated file does not trigger", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
  `);
  writeFileSync(join(repo.path, "README.md"), "# readme\n");
  stage(repo.path, "README.md");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});

it("exact file path watch does not match sibling files", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Specific migration
        watch: [supabase/migrations/001_init.sql]
        require_change_in: [docs/architecture/data-model.md]
        on_failure: block
  `);
  writeFileSync(join(repo.path, "supabase/migrations/002_users.sql"), "-- users\n");
  stage(repo.path, "supabase/migrations/002_users.sql");

  const { exitCode } = runHook(repo.path);
  expect(exitCode).toBe(0);
});

it("rule name appears in output on failure", () => {
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: Very Specific Rule Name XYZ
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { stdout } = runHook(repo.path);
  expect(stdout).toContain("Very Specific Rule Name XYZ");
});
