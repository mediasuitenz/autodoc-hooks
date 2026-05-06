from __future__ import annotations

import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


@dataclass
class ResolveConfig:
    type: Literal["script", "claude"]
    run: str = ""
    prompt: str = ""
    stage_after: bool = True


@dataclass
class Rule:
    name: str
    watch: list[str]
    require_change_in: list[str]
    on_failure: Literal["block", "warn"] = "block"
    scope: Literal["staged", "push"] = "staged"
    on_resolve: ResolveConfig | None = None


@dataclass
class Config:
    version: int = 1
    rules: list[Rule] = field(default_factory=list)


def load_config(path: Path = Path(".doc-guard.yml")) -> Config:
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path) as f:
        data = yaml.safe_load(f)

    defaults = data.get("defaults", {})
    default_on_failure = defaults.get("on_failure", "block")
    default_scope = defaults.get("scope", "staged")

    rules = []
    for r in data.get("rules", []):
        resolve_data = r.get("on_resolve")
        on_resolve = None
        if resolve_data:
            on_resolve = ResolveConfig(
                type=resolve_data["type"],
                run=resolve_data.get("run", ""),
                prompt=resolve_data.get("prompt", ""),
                stage_after=resolve_data.get("stage_after", True),
            )

        rules.append(Rule(
            name=r["name"],
            watch=r["watch"] if isinstance(r["watch"], list) else [r["watch"]],
            require_change_in=(
                r["require_change_in"]
                if isinstance(r["require_change_in"], list)
                else [r["require_change_in"]]
            ),
            on_failure=r.get("on_failure", default_on_failure),
            scope=r.get("scope", default_scope),
            on_resolve=on_resolve,
        ))

    return Config(version=data.get("version", 1), rules=rules)
