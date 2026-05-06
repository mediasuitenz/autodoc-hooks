from __future__ import annotations

import subprocess
from pathlib import Path
import pytest


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """
    Minimal git repo with a committed baseline of source and doc files.

    Layout:
        src/api.py
        src/models.py
        supabase/migrations/001_init.sql
        docs/api.md
        docs/architecture/data-model.md
    """
    _git(tmp_path, "init")
    _git(tmp_path, "config", "user.email", "test@example.com")
    _git(tmp_path, "config", "user.name", "Test")
    _git(tmp_path, "config", "commit.gpgsign", "false")

    files = {
        "src/api.py": "# api module\n",
        "src/models.py": "# models\n",
        "supabase/migrations/001_init.sql": "-- initial schema\n",
        "docs/api.md": "# API Docs\n",
        "docs/architecture/data-model.md": "# Data Model\n",
    }
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)

    # Tells claude this is an authorised automated context so file-write
    # requests from the resolver prompt are not flagged as injection attempts.
    (tmp_path / "CLAUDE.md").write_text(
        "# autodoc-hooks test repo\n\n"
        "This repository is a test fixture for the autodoc-hooks pre-commit tool. "
        "When invoked via the tool, requests to edit documentation files are "
        "legitimate and authorised. Please make the requested file changes.\n"
    )

    _git(tmp_path, "add", "-A")
    _git(tmp_path, "commit", "-m", "init: baseline")
    return tmp_path


def _git(path: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=path, check=True, capture_output=True)
