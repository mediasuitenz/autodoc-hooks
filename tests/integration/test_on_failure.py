"""
Tests for on_failure: block | warn, OR logic for require_change_in,
per-rule override, and multi-rule scenarios.
"""
from pathlib import Path
import pytest
from .helpers import run_hook, modify, stage, write_config


def test_block_exits_1_when_source_changed_without_docs(repo: Path):
    write_config(repo, """
        version: 1
        defaults:
          on_failure: block
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 1
    assert "[BLOCK]" in result.stdout


def test_warn_exits_0_when_source_changed_without_docs(repo: Path):
    write_config(repo, """
        version: 1
        defaults:
          on_failure: warn
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0
    assert "[WARN]" in result.stdout


def test_passes_when_source_and_doc_both_staged(repo: Path):
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
    """)
    modify(repo, "src/api.py")
    modify(repo, "docs/api.md", "# updated\n")
    stage(repo, "src/api.py", "docs/api.md")

    result = run_hook(repo)
    assert result.returncode == 0
    assert "[BLOCK]" not in result.stdout
    assert "[WARN]" not in result.stdout


def test_no_trigger_when_watched_files_not_staged(repo: Path):
    write_config(repo, """
        version: 1
        rules:
          - name: Migration docs
            watch: [supabase/migrations/**]
            require_change_in: [docs/architecture/data-model.md]
    """)
    # Stage a file outside the watch glob
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0


def test_or_logic_any_doc_change_satisfies_rule(repo: Path):
    """Changing any one of the require_change_in targets is enough to pass."""
    write_config(repo, """
        version: 1
        rules:
          - name: Docs
            watch: [src/**]
            require_change_in:
              - docs/api.md
              - docs/architecture/data-model.md
    """)
    modify(repo, "src/api.py")
    # Only update one of the two doc targets
    modify(repo, "docs/architecture/data-model.md", "# updated\n")
    stage(repo, "src/api.py", "docs/architecture/data-model.md")

    result = run_hook(repo)
    assert result.returncode == 0


def test_per_rule_on_failure_overrides_global(repo: Path):
    """Global default is warn but rule sets block — rule wins."""
    write_config(repo, """
        version: 1
        defaults:
          on_failure: warn
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 1
    assert "[BLOCK]" in result.stdout


def test_multiple_rules_one_fails_exits_1(repo: Path):
    """Two rules: first passes, second blocks — overall exit 1."""
    write_config(repo, """
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
    """)
    # Satisfy the first rule, fail the second
    (repo / "supabase/migrations/002_add_users.sql").write_text("-- users\n")
    modify(repo, "docs/architecture/data-model.md", "# updated\n")
    modify(repo, "src/api.py")  # triggers second rule, no doc update
    stage(
        repo,
        "supabase/migrations/002_add_users.sql",
        "docs/architecture/data-model.md",
        "src/api.py",
    )

    result = run_hook(repo)
    assert result.returncode == 1
    assert "API docs" in result.stdout


def test_multiple_rules_all_pass_exits_0(repo: Path):
    write_config(repo, """
        version: 1
        rules:
          - name: Migration docs
            watch: [supabase/migrations/**]
            require_change_in: [docs/architecture/data-model.md]
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
    """)
    (repo / "supabase/migrations/002_add_users.sql").write_text("-- users\n")
    modify(repo, "docs/architecture/data-model.md", "# updated\n")
    modify(repo, "src/api.py")
    modify(repo, "docs/api.md", "# updated\n")
    stage(
        repo,
        "supabase/migrations/002_add_users.sql",
        "docs/architecture/data-model.md",
        "src/api.py",
        "docs/api.md",
    )

    result = run_hook(repo)
    assert result.returncode == 0
