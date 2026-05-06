"""Shared helpers for integration tests. Not a pytest conftest — import explicitly."""
from __future__ import annotations

import subprocess
import sys
import textwrap
from pathlib import Path


def run_hook(repo: Path, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "autodoc_hooks.cli"],
        cwd=repo,
        capture_output=True,
        text=True,
        env=env,
    )


def modify(repo: Path, rel_path: str, content: str = "# changed\n") -> None:
    p = repo / rel_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def stage(repo: Path, *rel_paths: str) -> None:
    subprocess.run(["git", "add", *rel_paths], cwd=repo, check=True, capture_output=True)


def write_config(repo: Path, content: str) -> None:
    (repo / ".doc-guard.yml").write_text(textwrap.dedent(content).lstrip())


def make_script(repo: Path, name: str, body: str) -> Path:
    """Write an executable shell script into the repo root."""
    p = repo / name
    p.write_text("#!/bin/sh\n" + textwrap.dedent(body))
    p.chmod(0o755)
    return p
