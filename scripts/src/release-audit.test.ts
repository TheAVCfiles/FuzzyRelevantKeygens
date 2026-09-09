import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditRelease, type GateResult } from "./release-audit.js";

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), "release-audit-test-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "--quiet");
  git("config", "user.email", "audit@example.invalid");
  git("config", "user.name", "Release Audit Test");
  writeFileSync(join(cwd, "tracked.txt"), "exact\n");
  git("add", "tracked.txt");
  git("commit", "--quiet", "-m", "fixture");
  return {
    cwd,
    git,
    commit: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"),
  };
}

const passingGenerated = (): GateResult => ({ name: "generated_api_clients", ok: true });
const passingLockfile = (): GateResult => ({ name: "frozen_lockfile", ok: true });

test("accepts only the exact clean commit and tree", () => {
  const repo = repository();
  const result = auditRelease({
    ...repo,
    expectedCommit: repo.commit,
    expectedTree: repo.tree,
    generatedGate: passingGenerated,
    lockfileGate: passingLockfile,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.gates.map(({ name }) => name), [
    "clean_worktree",
    "exact_commit",
    "exact_tree",
    "generated_api_clients",
    "frozen_lockfile",
  ]);
});

test("fails for a dirty worktree", () => {
  const repo = repository();
  writeFileSync(join(repo.cwd, "untracked.txt"), "dirty\n");
  const result = auditRelease({
    ...repo,
    expectedCommit: repo.commit,
    expectedTree: repo.tree,
    generatedGate: passingGenerated,
    lockfileGate: passingLockfile,
  });
  assert.equal(result.ok, false);
  assert.equal(result.gates[0]?.ok, false);
});

test("fails for a different commit or tree", () => {
  const repo = repository();
  for (const [expectedCommit, expectedTree, gate] of [
    ["0".repeat(40), repo.tree, "exact_commit"],
    [repo.commit, "0".repeat(40), "exact_tree"],
  ] as const) {
    const result = auditRelease({
      ...repo,
      expectedCommit,
      expectedTree,
      generatedGate: passingGenerated,
      lockfileGate: passingLockfile,
    });
    assert.equal(result.ok, false);
    assert.equal(result.gates.find(({ name }) => name === gate)?.ok, false);
  }
});

function gateRepository(pnpmBody: string) {
  const repo = repository();
  for (const path of [
    "lib/api-spec/node_modules",
    "lib/api-client-react/src/generated",
    "lib/api-zod/src/generated",
  ]) {
    mkdirSync(join(repo.cwd, path), { recursive: true });
  }
  writeFileSync(join(repo.cwd, "lib/api-spec/package.json"), "{}\n");
  writeFileSync(join(repo.cwd, "lib/api-client-react/src/generated/api.ts"), "fresh\n");
  writeFileSync(join(repo.cwd, "lib/api-zod/src/generated/api.ts"), "fresh\n");
  repo.git("add", ".");
  repo.git("commit", "--quiet", "-m", "workspace");

  const bin = mkdtempSync(join(tmpdir(), "release-audit-bin-"));
  const pnpm = join(bin, "pnpm");
  writeFileSync(pnpm, `#!/bin/sh\nset -eu\n${pnpmBody}\n`);
  chmodSync(pnpm, 0o755);
  return {
    ...repo,
    commit: repo.git("rev-parse", "HEAD"),
    tree: repo.git("rev-parse", "HEAD^{tree}"),
    bin,
  };
}

test("fails when generated clients are stale", () => {
  const repo = gateRepository(`
case "$*" in
  *codegen*) printf 'stale\\n' >> lib/api-client-react/src/generated/api.ts ;;
esac
`);
  const originalPath = process.env.PATH;
  process.env.PATH = `${repo.bin}:${originalPath}`;
  try {
    const result = auditRelease({
      cwd: repo.cwd,
      expectedCommit: repo.commit,
      expectedTree: repo.tree,
    });
    assert.equal(result.ok, false);
    assert.equal(result.gates.find(({ name }) => name === "generated_api_clients")?.ok, false);
  } finally {
    process.env.PATH = originalPath;
  }
});

test("fails when code generation creates an untracked generated file", () => {
  const repo = gateRepository(`
case "$*" in
  *codegen*) printf 'new generated type\\n' > lib/api-zod/src/generated/new-type.ts ;;
esac
`);
  const originalPath = process.env.PATH;
  process.env.PATH = `${repo.bin}:${originalPath}`;
  try {
    const result = auditRelease({
      cwd: repo.cwd,
      expectedCommit: repo.commit,
      expectedTree: repo.tree,
    });
    assert.equal(result.ok, false);
    assert.equal(result.gates.find(({ name }) => name === "generated_api_clients")?.ok, false);
  } finally {
    process.env.PATH = originalPath;
  }
});

test("fails when the lockfile is stale", () => {
  const repo = gateRepository(`
case "$*" in
  *install*) exit 1 ;;
esac
`);
  const originalPath = process.env.PATH;
  process.env.PATH = `${repo.bin}:${originalPath}`;
  try {
    const result = auditRelease({
      cwd: repo.cwd,
      expectedCommit: repo.commit,
      expectedTree: repo.tree,
    });
    assert.equal(result.ok, false);
    assert.equal(result.gates.find(({ name }) => name === "frozen_lockfile")?.ok, false);
  } finally {
    process.env.PATH = originalPath;
  }
});