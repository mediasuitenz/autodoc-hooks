# autodoc-hooks

Blocks (or warns on) commits where source files changed but the corresponding documentation was not updated. Optionally runs a shell script or invokes `claude` to fix the gap automatically.

---

## Installation

### Husky (recommended for Node/npm projects)

**1. Install Husky and autodoc-hooks:**

```bash
npm install -D husky autodoc-hooks
```

**2. Initialise Husky** (creates `.husky/` and wires up the `prepare` script):

```bash
npx husky init
```

**3. Add autodoc-hooks to the pre-commit hook:**

```bash
echo "npx autodoc-hooks" >> .husky/pre-commit
```

**4. For `scope: push` rules**, also add a pre-push hook:

```bash
echo "npx autodoc-hooks" > .husky/pre-push
chmod +x .husky/pre-push
```

**5. Commit the Husky config:**

```bash
git add .husky package.json
git commit -m "chore: add autodoc-hooks pre-commit hook"
```

After this, `npx autodoc-hooks` runs automatically on every `git commit` (and `git push` if you added the pre-push hook). Other developers get the hooks automatically when they run `npm install`.

### pre-commit

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/mediasuitenz/autodoc-hooks
    rev: v0.3.0
    hooks:
      - id: autodoc-hooks
```

```bash
pre-commit install
pre-commit install --hook-type pre-push   # if you use scope: push rules
```

---

## Configuration

Create `.doc-guard.yml` in your project root.

### Minimal example

```yaml
version: 1

rules:
  - name: Database schema
    watch:
      - supabase/migrations/**
    require_change_in:
      - docs/architecture/data-model.md
```

### Full reference

```yaml
version: 1

defaults:
  on_failure: block   # block | warn  (default: block)
  scope: staged       # staged | push  (default: staged)

rules:
  - name: Database schema
    watch:
      - supabase/migrations/**
      - supabase/schema.sql
    require_change_in:
      - docs/architecture/data-model.md
    on_failure: block   # overrides defaults.on_failure for this rule
    scope: staged       # overrides defaults.scope for this rule
    on_resolve:
      type: script      # script | claude
      run: ./scripts/update-docs.sh {changed_files}
```

---

## Options

### `defaults`

| Key | Values | Default | Description |
|---|---|---|---|
| `on_failure` | `block` \| `warn` | `block` | What to do when a rule fires and docs are not updated |
| `scope` | `staged` \| `push` | `staged` | Which changed files to inspect |

### `rules[].on_failure`

Per-rule override of `defaults.on_failure`.

- **`block`** — exit 1, aborting the commit or push
- **`warn`** — print a warning but allow the operation to proceed (exit 0)

### `rules[].scope`

- **`staged`** — checks files in the git staging area (`git diff --cached`)
- **`push`** — checks files in commits not yet on the remote (`git diff <upstream>...HEAD`)

### `rules[].require_change_in`

A list of glob patterns. The rule passes if **any one** of them matches a staged/pushed file (OR logic).

### Glob syntax

| Pattern | Matches |
|---|---|
| `src/**` | Any file anywhere under `src/` |
| `**/*.md` | Any `.md` file in any directory |
| `docs/api.md` | Exactly that file |
| `src/*.py` | `.py` files directly in `src/` (not subdirs) |

---

## Auto-resolve with `on_resolve`

When a rule fires, `on_resolve` runs a command to fix the docs automatically. After it completes the rule is re-checked **once**. If the docs are still not updated the configured `on_failure` mode is applied.

### `type: script`

Runs a shell command. The script is responsible for writing **and staging** any doc files it changes.

```yaml
on_resolve:
  type: script
  run: ./scripts/update-data-model.sh {changed_files}
```

### `type: claude`

Invokes `claude -p "<prompt>"` (requires the [Claude Code CLI](https://claude.ai/code) to be installed and authenticated).

After `claude` exits, autodoc-hooks runs `git add` on any files matching `require_change_in` (controlled by `stage_after`).

```yaml
on_resolve:
  type: claude
  prompt: >-
    The following source files changed: {changed_files}.
    Update {missing_docs} to reflect these changes.
  stage_after: true      # auto-stage matching doc files after claude runs (default: true)
  allowed_tools:         # tools claude may use without interactive approval (default below)
    - Write
    - Edit
```

### Template variables

Available in both `run:` and `prompt:`:

| Variable | Value |
|---|---|
| `{changed_files}` | Space-separated list of staged source files that matched the watch pattern |
| `{missing_docs}` | Space-separated list of `require_change_in` patterns with no staged changes |
| `{rule_name}` | The rule's `name` field |

---

## Development

```bash
npm install
npm run build   # compile TypeScript → dist/
npm test        # run Vitest suite (47 tests)
```

The `tests/integration/resolve-claude.test.ts` evals require `claude` to be installed and authenticated. They are skipped automatically when `claude` is not on `$PATH`.
