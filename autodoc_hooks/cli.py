from __future__ import annotations

import sys
from pathlib import Path

from .config import load_config, Rule
from .git import get_staged_files, get_push_files
from .matcher import any_file_matches
from .resolver import run_resolver


def _changed_files(scope: str) -> list[str]:
    return get_push_files() if scope == "push" else get_staged_files()


def _missing_docs(rule: Rule, changed: list[str]) -> list[str]:
    """Returns require_change_in patterns if the rule triggered but no docs changed."""
    if not any_file_matches(changed, rule.watch):
        return []
    if any_file_matches(changed, rule.require_change_in):
        return []
    return rule.require_change_in


def main() -> None:
    try:
        config = load_config()
    except FileNotFoundError:
        sys.exit(0)

    exit_code = 0

    for rule in config.rules:
        changed = _changed_files(rule.scope)
        missing = _missing_docs(rule, changed)

        if not missing:
            continue

        print(f"\n[autodoc-hooks] Rule '{rule.name}' triggered")
        print(f"  Source changes in: {', '.join(rule.watch)}")
        print(f"  No doc changes in: {', '.join(missing)}")

        if rule.on_resolve:
            print(f"  Running auto-resolve ({rule.on_resolve.type})...")
            success = run_resolver(rule.on_resolve, changed, missing, rule.name)

            if success:
                recheck = _changed_files(rule.scope)
                if not _missing_docs(rule, recheck):
                    print("  Resolved: docs updated and staged.")
                    continue
                print("  Auto-resolve ran but docs still not updated.")
            else:
                print("  Auto-resolve failed.")

        if rule.on_failure == "warn":
            print("  [WARN] Proceeding without doc update.")
        else:
            print("  [BLOCK] Commit blocked. Update the listed docs or set on_failure: warn.")
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
