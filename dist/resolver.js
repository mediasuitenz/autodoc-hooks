import { spawnSync } from "node:child_process";
import { globSync } from "glob";
function substitute(template, vars) {
    return template
        .replace(/\{changed_files\}/g, vars.changed_files)
        .replace(/\{missing_docs\}/g, vars.missing_docs)
        .replace(/\{rule_name\}/g, vars.rule_name);
}
export function runResolver(resolve, changedFiles, missingDocs, ruleName) {
    const vars = {
        changed_files: changedFiles.join(" "),
        missing_docs: missingDocs.join(" "),
        rule_name: ruleName,
    };
    if (resolve.type === "script") {
        const cmd = substitute(resolve.run, vars);
        const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
        const [exe = "", ...args] = parts;
        const result = spawnSync(exe, args, { stdio: "inherit" });
        return result.status === 0;
    }
    if (resolve.type === "claude") {
        const prompt = substitute(resolve.prompt, vars);
        const result = spawnSync("claude", ["-p", prompt, "--allowedTools", resolve.allowedTools.join(",")], { stdio: "inherit" });
        if (result.status === 0 && resolve.stageAfter) {
            stageMatchingFiles(missingDocs);
        }
        return result.status === 0;
    }
    return false;
}
function stageMatchingFiles(patterns) {
    const files = patterns.flatMap((p) => globSync(p));
    if (files.length > 0) {
        spawnSync("git", ["add", ...files], { stdio: "inherit" });
    }
}
