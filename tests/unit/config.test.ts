import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../src/config.js";

function withConfig(content: string): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "autodoc-cfg-"));
  const path = join(dir, ".doc-guard.yml");
  writeFileSync(path, content);
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("loadConfig", () => {
  it("loads basic config with defaults", () => {
    const { path, cleanup } = withConfig(`
version: 1
defaults:
  on_failure: warn
rules:
  - name: DB schema
    watch:
      - supabase/migrations/**
    require_change_in:
      - docs/architecture/data-model.md
`);
    try {
      const config = loadConfig(path);
      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].name).toBe("DB schema");
      expect(config.rules[0].onFailure).toBe("warn");
      expect(config.rules[0].scope).toBe("staged");
    } finally {
      cleanup();
    }
  });

  it("per-rule on_failure overrides default", () => {
    const { path, cleanup } = withConfig(`
version: 1
defaults:
  on_failure: warn
rules:
  - name: API
    watch: [packages/api/**]
    require_change_in: [docs/api/**]
    on_failure: block
`);
    try {
      const config = loadConfig(path);
      expect(config.rules[0].onFailure).toBe("block");
    } finally {
      cleanup();
    }
  });

  it("parses on_resolve type: script", () => {
    const { path, cleanup } = withConfig(`
version: 1
rules:
  - name: Docs
    watch: [src/**]
    require_change_in: [docs/**]
    on_resolve:
      type: script
      run: ./update-docs.sh {changed_files}
`);
    try {
      const config = loadConfig(path);
      const r = config.rules[0].onResolve!;
      expect(r.type).toBe("script");
      expect(r.run).toContain("{changed_files}");
    } finally {
      cleanup();
    }
  });

  it("parses on_resolve type: claude with stage_after: false", () => {
    const { path, cleanup } = withConfig(`
version: 1
rules:
  - name: Docs
    watch: [src/**]
    require_change_in: [docs/**]
    on_resolve:
      type: claude
      prompt: "Update {missing_docs} based on {changed_files}"
      stage_after: false
`);
    try {
      const config = loadConfig(path);
      const r = config.rules[0].onResolve!;
      expect(r.type).toBe("claude");
      expect(r.stageAfter).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("throws when config file is missing", () => {
    expect(() => loadConfig("/nonexistent/.doc-guard.yml")).toThrow();
  });

  it("coerces scalar watch/require_change_in to arrays", () => {
    const { path, cleanup } = withConfig(`
version: 1
rules:
  - name: Solo
    watch: src/**
    require_change_in: docs/**
`);
    try {
      const config = loadConfig(path);
      expect(Array.isArray(config.rules[0].watch)).toBe(true);
      expect(Array.isArray(config.rules[0].requireChangeIn)).toBe(true);
    } finally {
      cleanup();
    }
  });
});
