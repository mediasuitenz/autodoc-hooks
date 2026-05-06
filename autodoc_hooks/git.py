import subprocess


def get_staged_files() -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True,
        text=True,
    )
    return [f for f in result.stdout.splitlines() if f]


def get_push_files() -> list[str]:
    branch = _current_branch()
    upstream_result = subprocess.run(
        ["git", "for-each-ref", "--format=%(upstream:short)", f"refs/heads/{branch}"],
        capture_output=True,
        text=True,
    )
    upstream = upstream_result.stdout.strip()
    if not upstream:
        return []

    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMR", f"{upstream}...HEAD"],
        capture_output=True,
        text=True,
    )
    return [f for f in result.stdout.splitlines() if f]


def _current_branch() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()
