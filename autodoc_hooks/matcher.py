import re


def path_matches_glob(path: str, pattern: str) -> bool:
    path = path.replace("\\", "/")
    pattern = pattern.replace("\\", "/")

    parts: list[str] = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        if c == "*":
            if i + 1 < len(pattern) and pattern[i + 1] == "*":
                parts.append(".*")
                i += 2
                # consume the trailing slash so foo/** matches foo/bar not foo//bar
                if i < len(pattern) and pattern[i] == "/":
                    parts.append("/?")
                    i += 1
            else:
                parts.append("[^/]*")
                i += 1
        elif c == "?":
            parts.append("[^/]")
            i += 1
        else:
            parts.append(re.escape(c))
            i += 1

    return bool(re.match("^" + "".join(parts) + "$", path))


def any_file_matches(files: list[str], patterns: list[str]) -> bool:
    return any(path_matches_glob(f, p) for f in files for p in patterns)
