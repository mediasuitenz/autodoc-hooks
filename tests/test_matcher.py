import pytest
from autodoc_hooks.matcher import path_matches_glob, any_file_matches


@pytest.mark.parametrize("path,pattern,expected", [
    ("supabase/migrations/001_init.sql", "supabase/migrations/**", True),
    ("supabase/migrations/sub/001.sql",  "supabase/migrations/**", True),
    ("docs/api/endpoints.md",            "docs/api/**",            True),
    ("src/foo.py",                        "src/**",                 True),
    ("src/foo.py",                        "docs/**",                False),
    ("supabase/schema.sql",              "supabase/migrations/**",  False),
    ("README.md",                        "*.md",                   True),
    ("docs/README.md",                   "*.md",                   False),   # * doesn't cross /
    ("docs/README.md",                   "**/*.md",                True),
    ("a/b/c/d.txt",                      "a/**/d.txt",             True),
    ("a/d.txt",                          "a/**/d.txt",             True),
])
def test_path_matches_glob(path, pattern, expected):
    assert path_matches_glob(path, pattern) == expected


def test_any_file_matches_hit():
    files = ["supabase/migrations/001.sql", "src/foo.py"]
    assert any_file_matches(files, ["supabase/migrations/**"])


def test_any_file_matches_miss():
    files = ["supabase/migrations/001.sql", "src/foo.py"]
    assert not any_file_matches(files, ["docs/**"])


def test_any_file_matches_multiple_patterns():
    files = ["docs/api/foo.md"]
    assert any_file_matches(files, ["docs/architecture/**", "docs/api/**"])
