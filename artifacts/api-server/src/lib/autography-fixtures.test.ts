import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("signing, dismissal, and fixture fallback preserve the trust boundary", { concurrency: false }, async () => {
  const originalCwd = process.cwd();
  const isolatedCwd = await mkdtemp(join(tmpdir(), "autography-regression-"));
  const originalKey = process.env.GEMINI_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
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
    const {
      AutographyAdkFlowError,
      runAutographyAgentFlow,
    } = await import("./agent-builder-flow");
    const beforeFallbackReceipts = fixtures.getReceipts().length;
    const fallback = await runAutographyAgentFlow();

    assert.equal(fallback.mode, "fixture_fallback");
    assert.equal(fallback.runtime_evidence[0]?.framework, "Google ADK (@google/adk)");
    assert.equal(fallback.runtime_evidence[0]?.status, "failed");
    assert.deepEqual(
      fallback.stages.map((stage) => stage.status),
      ["fixture retained", "fixture retained", "fixture retained", "fixture retained"],
    );
    assert.equal(fixtures.verifyDrop("DROP-SF06-0001").status, "SEALED");
    assert.equal(fixtures.getReceipts().length, beforeFallbackReceipts + 1);

    const calls: Array<{ id: string; role: string; prompt: string }> = [];
    const adkResult = await runAutographyAgentFlow({
      async runStage(input) {
        calls.push({ id: input.id, role: input.role, prompt: input.prompt });
        return {
          output: JSON.stringify({ stage: input.id, status: "bounded" }),
          evidence: {
            stage_id: input.id,
            framework: "Google ADK (@google/adk)",
            provider: "Google Gemini API",
            model: input.model,
            execution_id: `adk-${input.id}`,
            tools: [],
            latency_ms: 1,
            status: "completed",
            activity: `Executed ${input.role} through Google ADK.`,
          },
        };
      },
    });

    assert.equal(adkResult.mode, "google_adk");
    assert.equal(adkResult.runtime_evidence.every((evidence) => evidence.framework === "Google ADK (@google/adk)"), true);
    assert.deepEqual(calls.map((call) => call.id), ["G1", "G2", "G3", "G4"]);
    assert.match(calls[2]!.prompt, /G1 OUTPUT:[\s\S]*G2 OUTPUT:/);
    assert.match(calls[3]!.prompt, /G3 OUTPUT:/);
    assert.deepEqual(
      adkResult.runtime_evidence.map((evidence) => [
        evidence.framework,
        evidence.execution_id,
        evidence.status,
      ]),
      [
        ["Google ADK (@google/adk)", "adk-G1", "completed"],
        ["Google ADK (@google/adk)", "adk-G2", "completed"],
        ["Google ADK (@google/adk)", "adk-G3", "completed"],
        ["Google ADK (@google/adk)", "adk-G4", "completed"],
      ],
    );

    process.env.NODE_ENV = "production";
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () => runAutographyAgentFlow(),
      (error) =>
        error instanceof AutographyAdkFlowError &&
        error.runtimeEvidence[0]?.status === "failed",
    );
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    process.chdir(originalCwd);
    await rm(isolatedCwd, { recursive: true, force: true });
  }
});