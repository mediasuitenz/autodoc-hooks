export function pathMatchesGlob(path: string, pattern: string): boolean {
  path = path.replace(/\\/g, "/");
  pattern = pattern.replace(/\\/g, "/");

  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*") {
      if (i + 1 < pattern.length && pattern[i + 1] === "*") {
        regex += ".*";
        i += 2;
        if (i < pattern.length && pattern[i] === "/") {
          regex += "/?";
          i++;
        }
      } else {
        regex += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      regex += "[^/]";
      i++;
    } else {
      regex += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  regex += "$";

  return new RegExp(regex).test(path);
}

export function anyFileMatches(files: string[], patterns: string[]): boolean {
  return files.some((f) => patterns.some((p) => pathMatchesGlob(f, p)));
}
