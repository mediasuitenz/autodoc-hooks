import { describe, it, expect } from "vitest";
import { pathMatchesGlob, anyFileMatches } from "../../src/matcher.js";

describe("pathMatchesGlob", () => {
  it.each([
    ["supabase/migrations/001_init.sql", "supabase/migrations/**", true],
    ["supabase/migrations/sub/001.sql", "supabase/migrations/**", true],
    ["docs/api/endpoints.md", "docs/api/**", true],
    ["src/foo.py", "src/**", true],
    ["src/foo.py", "docs/**", false],
    ["supabase/schema.sql", "supabase/migrations/**", false],
    ["README.md", "*.md", true],
    ["docs/README.md", "*.md", false],
    ["docs/README.md", "**/*.md", true],
    ["a/b/c/d.txt", "a/**/d.txt", true],
    ["a/d.txt", "a/**/d.txt", true],
  ])("%s matches %s → %s", (path, pattern, expected) => {
    expect(pathMatchesGlob(path, pattern)).toBe(expected);
  });
});

describe("anyFileMatches", () => {
  it("returns true when a file matches a pattern", () => {
    expect(
      anyFileMatches(
        ["supabase/migrations/001.sql", "src/foo.py"],
        ["supabase/migrations/**"]
      )
    ).toBe(true);
  });

  it("returns false when no file matches any pattern", () => {
    expect(
      anyFileMatches(["supabase/migrations/001.sql", "src/foo.py"], ["docs/**"])
    ).toBe(false);
  });

  it("returns true when any one of multiple patterns matches", () => {
    expect(
      anyFileMatches(
        ["docs/api/foo.md"],
        ["docs/architecture/**", "docs/api/**"]
      )
    ).toBe(true);
  });
});
