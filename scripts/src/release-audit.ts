import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type GateName =
  | "clean_worktree"
  | "exact_commit"
  | "exact_tree"
  | "generated_api_clients"
  | "frozen_lockfile";

export interface GateResult {
  name: GateName;
  ok: boolean;
  error?: string;
}

export interface AuditEnvelope {
  schema: "autography.release-audit/v1";
  ok: boolean;
  commit: string;
  tree: string;
  expectedCommit: string;
  expectedTree: string;
  gates: GateResult[];
}

export interface AuditOptions {
  cwd: string;
  expectedCommit: string;
  expectedTree: string;
  generatedGate?: () => GateResult;
  lockfileGate?: () => GateResult;
}

function run(cwd: string, command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function git(cwd: string, ...args: string[]): string {
  const result = run(cwd, "git", args);
  if (!result.ok) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function failed(name: GateName, error: string): GateResult {
  return { name, ok: false, error };
}

function checkGenerated(root: string, commit: string): GateResult {
  const worktree = mkdtempSync(join(tmpdir(), "autography-release-audit-"));
  try {
    const add = run(root, "git", ["worktree", "add", "--quiet", "--detach", worktree, commit]);
    if (!add.ok) return failed("generated_api_clients", "could not create audit worktree");

    // Dependencies are reused read-only from the local checkout. The generator
    // itself writes only to the detached temporary worktree.
    symlinkSync(join(root, "lib/api-spec/node_modules"), join(worktree, "lib/api-spec/node_modules"), "dir");
    const codegen = run(worktree, "pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]);
    if (!codegen.ok) {
      return failed("generated_api_clients", "offline API code generation failed");
    }
    const generatedStatus = run(worktree, "git", [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--",
      "lib/api-client-react/src/generated",
      "lib/api-zod/src/generated",
    ]);
    return generatedStatus.ok && generatedStatus.stdout === ""
      ? { name: "generated_api_clients", ok: true }
      : failed("generated_api_clients", "generated API clients are stale");
  } finally {
    run(root, "git", ["worktree", "remove", "--force", worktree]);
    rmSync(worktree, { recursive: true, force: true });
  }
}

function checkLockfile(root: string, commit: string): GateResult {
  const worktree = mkdtempSync(join(tmpdir(), "autography-lock-audit-"));
  try {
    const add = run(root, "git", ["worktree", "add", "--quiet", "--detach", worktree, commit]);
    if (!add.ok) return failed("frozen_lockfile", "could not create audit worktree");
    const install = run(worktree, "pnpm", [
      "install",
      "--lockfile-only",
      "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    return install.ok
      ? { name: "frozen_lockfile", ok: true }
      : failed("frozen_lockfile", "pnpm-lock.yaml is stale");
  } finally {
    run(root, "git", ["worktree", "remove", "--force", worktree]);
    rmSync(worktree, { recursive: true, force: true });
  }
}

export function auditRelease(options: AuditOptions): AuditEnvelope {
  const root = resolve(options.cwd);
  const commit = git(root, "rev-parse", "HEAD");
  const tree = git(root, "rev-parse", "HEAD^{tree}");
  const dirty = git(root, "status", "--porcelain=v1", "--untracked-files=all");
  const gates: GateResult[] = [
    dirty
      ? failed("clean_worktree", "worktree is dirty")
      : { name: "clean_worktree", ok: true },
    commit === options.expectedCommit
      ? { name: "exact_commit", ok: true }
      : failed("exact_commit", "HEAD does not match expected commit"),
    tree === options.expectedTree
      ? { name: "exact_tree", ok: true }
      : failed("exact_tree", "HEAD tree does not match expected tree"),
  ];

  const identityOkay = gates.every((gate) => gate.ok);
  gates.push(
    identityOkay
      ? (options.generatedGate ?? (() => checkGenerated(root, commit)))()
      : failed("generated_api_clients", "skipped because repository identity failed"),
  );
  gates.push(
    identityOkay
      ? (options.lockfileGate ?? (() => checkLockfile(root, commit)))()
      : failed("frozen_lockfile", "skipped because repository identity failed"),
  );

  return {
    schema: "autography.release-audit/v1",
    ok: gates.every((gate) => gate.ok),
    commit,
    tree,
    expectedCommit: options.expectedCommit,
    expectedTree: options.expectedTree,
    gates,
  };
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const isMain = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const expectedCommit = argument("--expected-commit");
  const expectedTree = argument("--expected-tree");
  if (!expectedCommit || !expectedTree) {
    process.stderr.write("usage: release-audit --expected-commit <sha> --expected-tree <tree> \n");
    process.exitCode = 2;
  } else {
    try {
      const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
      const envelope = auditRelease({ cwd: root, expectedCommit, expectedTree });
      process.stdout.write(`${JSON.stringify(envelope)}\n`);
      process.exitCode = envelope.ok ? 0 : 1;
    } catch {
      process.stdout.write(`${JSON.stringify({
        schema: "autography.release-audit/v1",
        ok: false,
        error: "audit could not inspect the repository",
      })}\n`);
      process.exitCode = 1;
    }
  }
}