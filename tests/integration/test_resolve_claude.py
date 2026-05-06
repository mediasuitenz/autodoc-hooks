"""
Evals for on_resolve: type: claude.

These tests invoke the real claude CLI and require it to be installed
and configured with a valid API key. They are skipped when claude is absent.

Each test uses a precise, unambiguous prompt so claude's behaviour is
deterministic enough to assert on.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from .helpers import run_hook, modify, stage, write_config

pytestmark = pytest.mark.skipif(
    shutil.which("claude") is None,
    reason="claude CLI not available",
)

# Single-line prompt, no embedded newlines — embeds cleanly as a YAML
# double-quoted scalar. Plain user-like request; avoids "I am a tool"
# framing that triggers claude's injection-detection heuristics.
_PROMPT = (
    "The file {changed_files} was just modified. "
    "Please edit {missing_docs} and append this line at the end: "
    "<!-- updated after changes to {changed_files} -->"
)


def test_claude_updates_doc_file_and_hook_passes(repo: Path):
    """claude writes and stages the doc — re-check passes — exit 0."""
    write_config(repo, f"""
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
            on_resolve:
              type: claude
              prompt: "{_PROMPT}"
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0, f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    assert "Resolved" in result.stdout

    # Doc was modified from the committed baseline ("# API Docs\n")
    doc_content = (repo / "docs/api.md").read_text()
    assert doc_content != "# API Docs\n"


def test_claude_stage_after_true_auto_stages_doc(repo: Path):
    """
    With stage_after:true (default), the hook calls `git add` on the doc
    pattern after claude runs, so the re-check sees the file as staged.
    """
    write_config(repo, f"""
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
            on_resolve:
              type: claude
              prompt: "{_PROMPT}"
              stage_after: true
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)
    assert result.returncode == 0

    # Verify docs/api.md ended up staged
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=repo, capture_output=True, text=True,
    ).stdout.splitlines()
    assert "docs/api.md" in staged


def test_claude_stage_after_false_file_written_but_not_staged(repo: Path):
    """
    stage_after:false — claude writes the doc to disk but the hook
    does NOT stage it, so the re-check fails → on_failure: block.
    """
    write_config(repo, f"""
        version: 1
        rules:
          - name: API docs
            watch: [src/**]
            require_change_in: [docs/api.md]
            on_failure: block
            on_resolve:
              type: claude
              prompt: "{_PROMPT}"
              stage_after: false
    """)
    modify(repo, "src/api.py")
    stage(repo, "src/api.py")

    result = run_hook(repo)

    # Re-check sees unstaged doc → block (the key assertion for this eval)
    assert result.returncode == 1
    assert "[BLOCK]" in result.stdout

    # Confirm the doc was written to disk but NOT staged
    staged = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=repo, capture_output=True, text=True,
    ).stdout.splitlines()
    assert "docs/api.md" not in staged


def test_claude_template_vars_reach_prompt(repo: Path):
    """
    The template vars {changed_files}, {missing_docs}, {rule_name} are
    substituted into the prompt before passing to claude.
    We verify indirectly: claude successfully writes the exact target file,
    which it can only know if the prompt contained the correct path.
    """
    write_config(repo, f"""
        version: 1
        rules:
          - name: Data model
            watch: [supabase/migrations/**]
            require_change_in: [docs/architecture/data-model.md]
            on_failure: block
            on_resolve:
              type: claude
              prompt: "{_PROMPT}"
    """)
    (repo / "supabase/migrations/002_users.sql").write_text("-- users\n")
    stage(repo, "supabase/migrations/002_users.sql")

    result = run_hook(repo)
    assert result.returncode == 0, f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"

    # Claude can only know which file to update if {missing_docs} was substituted
    # correctly in the prompt — verified by the file being modified from its baseline.
    doc = (repo / "docs/architecture/data-model.md").read_text()
    assert doc != "# Data Model\n"
