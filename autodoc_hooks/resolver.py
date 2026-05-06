from __future__ import annotations

import glob as glob_module
import shlex
import subprocess
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .config import ResolveConfig


def run_resolver(
    resolve: ResolveConfig,
    changed_files: list[str],
    missing_docs: list[str],
    rule_name: str,
) -> bool:
    """Run the configured resolver. Returns True if it completed without error."""
    vars_ = {
        "changed_files": " ".join(changed_files),
        "missing_docs": " ".join(missing_docs),
        "rule_name": rule_name,
    }

    if resolve.type == "script":
        cmd = resolve.run.format(**vars_)
        result = subprocess.run(shlex.split(cmd))
        return result.returncode == 0

    if resolve.type == "claude":
        prompt = resolve.prompt.format(**vars_)
        cmd = ["claude", "-p", prompt, "--allowedTools", ",".join(resolve.allowed_tools)]
        result = subprocess.run(cmd)
        if result.returncode == 0 and resolve.stage_after:
            _stage_matching_files(missing_docs)
        return result.returncode == 0

    return False


def _stage_matching_files(patterns: list[str]) -> None:
    files = []
    for pattern in patterns:
        files.extend(glob_module.glob(pattern, recursive=True))
    if files:
        subprocess.run(["git", "add"] + files)
