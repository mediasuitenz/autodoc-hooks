import { load } from "js-yaml";
import { readFileSync, existsSync } from "node:fs";
function toArray(value) {
    if (Array.isArray(value))
        return value;
    return [value];
}
export function loadConfig(configPath = ".doc-guard.yml") {
    if (!existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }
    const raw = load(readFileSync(configPath, "utf8"));
    const defaults = (raw.defaults ?? {});
    const defaultOnFailure = (defaults.on_failure ?? "block");
    const defaultScope = (defaults.scope ?? "staged");
    const rules = (raw.rules ?? []).map((r) => {
        const resolveData = r.on_resolve;
        const onResolve = resolveData
            ? {
                type: resolveData.type,
                run: resolveData.run ?? "",
                prompt: resolveData.prompt ?? "",
                stageAfter: resolveData.stage_after ?? true,
                allowedTools: resolveData.allowed_tools ?? [
                    "Write",
                    "Edit",
                ],
            }
            : null;
        return {
            name: r.name,
            watch: toArray(r.watch),
            requireChangeIn: toArray(r.require_change_in),
            onFailure: r.on_failure ?? defaultOnFailure,
            scope: r.scope ?? defaultScope,
            onResolve,
        };
    });
    return { version: raw.version ?? 1, rules };
}
