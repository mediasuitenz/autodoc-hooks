import textwrap
from pathlib import Path
import pytest
from autodoc_hooks.config import load_config


def cfg(tmp_path: Path, content: str) -> Path:
    p = tmp_path / ".doc-guard.yml"
    p.write_text(textwrap.dedent(content))
    return p


def test_basic_load(tmp_path):
    path = cfg(tmp_path, """
        version: 1
        defaults:
          on_failure: warn
        rules:
          - name: DB schema
            watch:
              - supabase/migrations/**
            require_change_in:
              - docs/architecture/data-model.md
    """)
    config = load_config(path)
    assert len(config.rules) == 1
    rule = config.rules[0]
    assert rule.name == "DB schema"
    assert rule.on_failure == "warn"
    assert rule.scope == "staged"


def test_rule_overrides_default(tmp_path):
    path = cfg(tmp_path, """
        version: 1
        defaults:
          on_failure: warn
        rules:
          - name: API
            watch: [packages/api/**]
            require_change_in: [docs/api/**]
            on_failure: block
    """)
    config = load_config(path)
    assert config.rules[0].on_failure == "block"


def test_on_resolve_script(tmp_path):
    path = cfg(tmp_path, """
        version: 1
        rules:
          - name: Docs
            watch: [src/**]
            require_change_in: [docs/**]
            on_resolve:
              type: script
              run: ./update-docs.sh {changed_files}
    """)
    config = load_config(path)
    r = config.rules[0].on_resolve
    assert r is not None
    assert r.type == "script"
    assert "{changed_files}" in r.run


def test_on_resolve_claude(tmp_path):
    path = cfg(tmp_path, """
        version: 1
        rules:
          - name: Docs
            watch: [src/**]
            require_change_in: [docs/**]
            on_resolve:
              type: claude
              prompt: "Update {missing_docs} based on {changed_files}"
              stage_after: false
    """)
    config = load_config(path)
    r = config.rules[0].on_resolve
    assert r.type == "claude"
    assert r.stage_after is False


def test_missing_config_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_config(tmp_path / ".doc-guard.yml")


def test_scalar_watch_coerced_to_list(tmp_path):
    path = cfg(tmp_path, """
        version: 1
        rules:
          - name: Solo
            watch: src/**
            require_change_in: docs/**
    """)
    config = load_config(path)
    assert isinstance(config.rules[0].watch, list)
    assert isinstance(config.rules[0].require_change_in, list)
