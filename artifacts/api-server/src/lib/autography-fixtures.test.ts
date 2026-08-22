import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("signing, dismissal, and fixture fallback preserve the trust boundary", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const isolatedCwd = await mkdtemp(join(tmpdir(), "autography-regression-"));
  const originalKey = process.env.GEMINI_API_KEY;
  process.chdir(isolatedCwd);

  try {
    const fixtures = await import("./autography-fixtures");
    const beforeDismissReceipts = fixtures.getReceipts().length;
    const dismissal = fixtures.dismissPullRequest();

    assert.equal(dismissal.dismissed, true);
    assert.match(dismissal.receipt_entry, /Nothing was published/);
    assert.equal(fixtures.verifyDrop("DROP-SF06-0001").status, "NOT_IN_REGISTRY");
    assert.equal(fixtures.getReceipts().length, beforeDismissReceipts + 1);
    assert.equal(fixtures.getReceipts()[0]?.action, "PR dismissed");

    const before = fixtures.getReceipts().length;
    const result = fixtures.signMove("mv_clarify");

    assert.ok(result);
    assert.equal(result.evaluation.pass, true);
    assert.ok(result.drop);
    assert.equal(fixtures.getReceipts().length, before + 2);
    assert.equal(fixtures.getReceipts()[0]?.action, "Drop issued");
    assert.equal(fixtures.verifyDrop(result.drop.hash).status, "SEALED");
    assert.equal(fixtures.verifyDrop(result.drop.drop_id).status, "SEALED");

    delete process.env.GEMINI_API_KEY;
    const { runAutographyAgentFlow } = await import("./agent-builder-flow");
    const beforeFallbackReceipts = fixtures.getReceipts().length;
    const fallback = await runAutographyAgentFlow();

    assert.equal(fallback.mode, "fixture_fallback");
    assert.deepEqual(
      fallback.stages.map((stage) => stage.status),
      ["fixture retained", "fixture retained", "fixture retained", "fixture retained"],
    );
    assert.equal(fixtures.verifyDrop("DROP-SF06-0001").status, "SEALED");
    assert.equal(fixtures.getReceipts().length, beforeFallbackReceipts + 1);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    process.chdir(originalCwd);
    await rm(isolatedCwd, { recursive: true, force: true });
  }
});