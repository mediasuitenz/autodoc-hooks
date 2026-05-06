import { it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setupRepo, runHook, modify, stage, writeConfig, makeScript, type Repo } from "./helpers.js";

let repo: Repo;
beforeEach(() => { repo = setupRepo(); });
afterEach(() => repo.cleanup());

it("script updates and stages docs → passes", () => {
  makeScript(repo.path, "resolve.sh", `
    printf '# Updated by resolve script\\n' > docs/api.md
    git add docs/api.md
  `);
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
        on_resolve:
          type: script
          run: ./resolve.sh
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("Resolved");
});

it("script noop → re-check fails → block", () => {
  makeScript(repo.path, "noop.sh", "exit 0");
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
        on_resolve:
          type: script
          run: ./noop.sh
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("[BLOCK]");
});

it("script noop → re-check fails → warn", () => {
  makeScript(repo.path, "noop.sh", "exit 0");
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: warn
        on_resolve:
          type: script
          run: ./noop.sh
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("[WARN]");
});

it("script exits non-zero → resolver failed → block", () => {
  makeScript(repo.path, "fail.sh", "exit 1");
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: block
        on_resolve:
          type: script
          run: ./fail.sh
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(1);
  expect(stdout).toContain("[BLOCK]");
});

it("script exits non-zero → resolver failed → warn", () => {
  makeScript(repo.path, "fail.sh", "exit 1");
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: warn
        on_resolve:
          type: script
          run: ./fail.sh
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  const { exitCode, stdout } = runHook(repo.path);
  expect(exitCode).toBe(0);
  expect(stdout).toContain("[WARN]");
});

it("template vars {changed_files}, {missing_docs}, {rule_name} are substituted", () => {
  makeScript(repo.path, "capture.sh", 'echo "$*" > captured.txt');
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: warn
        on_resolve:
          type: script
          run: ./capture.sh {changed_files} SEP {missing_docs} SEP {rule_name}
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  runHook(repo.path);

  const captured = readFileSync(join(repo.path, "captured.txt"), "utf8");
  expect(captured).toContain("src/api.py");
  expect(captured).toContain("docs/api.md");
  expect(captured).toContain("API docs");
});

it("resolver is invoked exactly once — no retry", () => {
  makeScript(repo.path, "count.sh", 'echo "run" >> invocations.txt\nexit 0');
  writeConfig(repo.path, `
    version: 1
    rules:
      - name: API docs
        watch: [src/**]
        require_change_in: [docs/api.md]
        on_failure: warn
        on_resolve:
          type: script
          run: ./count.sh
  `);
  modify(repo.path, "src/api.py");
  stage(repo.path, "src/api.py");

  runHook(repo.path);

  const lines = readFileSync(join(repo.path, "invocations.txt"), "utf8").split("\n").filter(Boolean);
  expect(lines).toHaveLength(1);
});
