export interface ResolveConfig {
    type: "script" | "claude";
    run: string;
    prompt: string;
    stageAfter: boolean;
    allowedTools: string[];
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
export declare function loadConfig(configPath?: string): Config;
