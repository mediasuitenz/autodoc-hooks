import { load } from "js-yaml";
import { readFileSync, existsSync } from "node:fs";

export interface ResolveConfig {
  type: "script" | "claude";
  run: string;
  prompt: string;
  stageAfter: boolean;
  allowedTools: string[];
  timeoutMs: number;
}

export interface Rule {
  name: string;
  watch: string[];
  requireChangeIn: string[];
  onFailure: "block" | "warn";
  scope: "staged" | "push";
  onResolve: ResolveConfig | null;
}

export interface Config {
  version: number;
  rules: Rule[];
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  return [value as string];
}

export function loadConfig(configPath = ".doc-guard.yml"): Config {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = load(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  const defaults = (raw.defaults ?? {}) as Record<string, string>;
  const defaultOnFailure = (defaults.on_failure ?? "block") as "block" | "warn";
  const defaultScope = (defaults.scope ?? "staged") as "staged" | "push";

  const rules: Rule[] = ((raw.rules ?? []) as Record<string, unknown>[]).map(
    (r) => {
      const resolveData = r.on_resolve as Record<string, unknown> | undefined;
      const onResolve: ResolveConfig | null = resolveData
        ? {
            type: resolveData.type as "script" | "claude",
            run: (resolveData.run as string) ?? "",
            prompt: (resolveData.prompt as string) ?? "",
            stageAfter: (resolveData.stage_after as boolean) ?? true,
            allowedTools: (resolveData.allowed_tools as string[]) ?? [
              "Write",
              "Edit",
              "Read",
            ],
            timeoutMs: (resolveData.timeout_ms as number) ?? 120_000,
          }
        : null;

      return {
        name: r.name as string,
        watch: toArray(r.watch),
        requireChangeIn: toArray(r.require_change_in),
        onFailure: (r.on_failure as "block" | "warn") ?? defaultOnFailure,
        scope: (r.scope as "staged" | "push") ?? defaultScope,
        onResolve,
      };
    }
  );

  return { version: (raw.version as number) ?? 1, rules };
}
