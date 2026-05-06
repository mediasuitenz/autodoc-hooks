import { spawnSync } from "node:child_process";
function git(...args) {
    const result = spawnSync("git", args, { encoding: "utf8" });
    return result.stdout ?? "";
}
export function getStagedFiles() {
    return git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
        .split("\n")
        .filter(Boolean);
}
export function getPushFiles() {
    const branch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
    const upstream = git("for-each-ref", "--format=%(upstream:short)", `refs/heads/${branch}`).trim();
    if (!upstream)
        return [];
    return git("diff", "--name-only", "--diff-filter=ACMR", `${upstream}...HEAD`)
        .split("\n")
        .filter(Boolean);
}
