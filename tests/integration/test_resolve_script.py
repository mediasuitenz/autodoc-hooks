"""
Tests for on_resolve: type: script.

Scripts run in the repo root (cwd inherited from the hook process).
They are responsible for updating AND staging any doc files they touch
(unlike type: claude, which has stage_after to handle staging automatically).
"""
from pathlib import Path
import pytest
from .helpers import run_hook, modify, stage, write_config, make_script


def test_script_updates_and_stages_docs_passes(repo: Path):
    """Script writes and stages the doc file — re-check passes, exit 0."""
    make_script(repo, "resolve.sh", """
        printf '# Updated by resolve script\\n' > docs/api.md
        git add docs/api.md
    """)
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
            on_resolve:
              type: script
              run: ./resolve.sh
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0
    assert "Resolved" in result.stdout


def test_script_noop_falls_through_to_block(repo: Path):
    """Script exits 0 but doesn't update docs — re-check still fails — block."""
    make_script(repo, "noop.sh", "exit 0\n")
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
            on_resolve:
              type: script
              run: ./noop.sh
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 1
    assert "[BLOCK]" in result.stdout


def test_script_noop_falls_through_to_warn(repo: Path):
    """Script exits 0 but doesn't update docs — on_failure: warn — exit 0."""
    make_script(repo, "noop.sh", "exit 0\n")
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: warn
            on_resolve:
              type: script
              run: ./noop.sh
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0
    assert "[WARN]" in result.stdout


def test_script_failure_falls_through_to_block(repo: Path):
    """Script exits non-zero — resolver failed — on_failure: block — exit 1."""
    make_script(repo, "fail.sh", "exit 1\n")
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
            on_resolve:
              type: script
              run: ./fail.sh
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 1
    assert "[BLOCK]" in result.stdout


def test_script_failure_falls_through_to_warn(repo: Path):
    """Script exits non-zero — on_failure: warn — exit 0."""
    make_script(repo, "fail.sh", "exit 1\n")
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: warn
            on_resolve:
              type: script
              run: ./fail.sh
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0
    assert "[WARN]" in result.stdout


def test_script_receives_template_vars(repo: Path):
    """
    {changed_files}, {missing_docs}, and {rule_name} are substituted
    before the script is invoked.
    """
    make_script(repo, "capture.sh", 'echo "$*" > captured.txt\n')
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: warn
            on_resolve:
              type: script
              run: ./capture.sh {changed_files} SEP {missing_docs} SEP {rule_name}
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    run_hook(repo)

    captured = (repo / "captured.txt").read_text()
    assert "src/api.py" in captured
    assert "docs/api.md" in captured
    assert "API docs" in captured


def test_no_retry_after_failed_resolve(repo: Path):
    """
    Resolver is invoked exactly once. If it fails, the hook applies
    on_failure immediately — it does not retry.
    """
    # Script appends a line each time it runs
    make_script(repo, "count.sh", 'echo "run" >> invocations.txt\nexit 0\n')
    write_config(repo, """
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: warn
            on_resolve:
              type: script
              run: ./count.sh
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    run_hook(repo)

    lines = (repo / "invocations.txt").read_text().splitlines()
    assert len(lines) == 1, f"Expected 1 invocation, got {len(lines)}"
