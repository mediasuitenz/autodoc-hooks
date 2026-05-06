"""
Edge cases: missing config, empty staged index, new (untracked → staged) files,
glob boundary behaviour, and multiple source files where only some match.
"""
from pathlib import Path
import pytest
from .helpers import run_hook, modify, stage, write_config


def test_no_config_file_exits_0(repo: Path):
    """Without a .doc-guard.yml the hook must exit 0 silently."""
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0
    assert result.stdout == ""


def test_nothing_staged_exits_0(repo: Path):
    """No staged files — no rules trigger — exit 0."""
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
    """)
    # modify but do NOT stage
    modify(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0


def test_empty_rules_list_exits_0(repo: Path):
    write_config(repo, """
        version: 1
        rules: []
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0


def test_new_file_in_watch_glob_triggers_rule(repo: Path):
    """A brand-new (previously untracked) file being staged counts as a change."""
    write_config(repo, """
        version: 1
        rules:
          - name: Migration docs
            watch: [supabase/migrations/**]
            require_change_in: [docs/architecture/data-model.md]
            on_failure: block
    """)
    new_migration = repo / "supabase/migrations/002_add_users.sql"
    new_migration.write_text("-- users\n")
    stage(repo, "supabase/migrations/002_add_users.sql")

    result = run_hook(repo)
    assert result.returncode == 1
    assert "Migration docs" in result.stdout


def test_only_matching_watch_file_triggers_rule(repo: Path):
    """
    Staging two files: one inside the watch glob and one outside.
    The rule triggers because the watched file is staged, even though
    an unrelated file is also staged.
    """
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
    """)
    modify(repo, "src/api.py")                       # in watch
    modify(repo, "supabase/migrations/999_misc.sql")  # outside watch
    stage(repo, "src/api.py", "supabase/migrations/999_misc.sql")

    result = run_hook(repo)
    assert result.returncode == 1


def test_staging_only_unrelated_file_does_not_trigger(repo: Path):
    """
    Staging a file completely outside every watch glob — no rule fires.
    """
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
    """)
    (repo / "README.md").write_text("# readme\n")
    stage(repo, "README.md")

    result = run_hook(repo)
    assert result.returncode == 0


def test_exact_file_path_watch_matches_only_that_file(repo: Path):
    """watch: [supabase/migrations/001_init.sql] should not match other migrations."""
    write_config(repo, """
        version: 1
        rules:
          - name: Specific migration
            watch: [supabase/migrations/001_init.sql]
            require_change_in: [docs/architecture/data-model.md]
            on_failure: block
    """)
    # Stage a different migration — should NOT trigger the rule
    (repo / "supabase/migrations/002_users.sql").write_text("-- users\n")
    stage(repo, "supabase/migrations/002_users.sql")

    result = run_hook(repo)
    assert result.returncode == 0


def test_rule_name_appears_in_output_on_failure(repo: Path):
    """The rule's name is printed so the developer knows which rule fired."""
    write_config(repo, """
        version: 1
        rules:
          - name: Very Specific Rule Name XYZ
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert "Very Specific Rule Name XYZ" in result.stdout
