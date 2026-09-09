import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PodcastAdkResearchError,
  podcastAdkFramework,
  runPodcastAdkResearch,
  type PodcastAdkRuntime,
} from "./podcast-adk-research";

test("podcast research invokes the ADK runtime and emits safe completed evidence", async () => {
  let invoked = false;
  let receivedModel = "";
  let receivedPrompt = "";
  const groundingMetadata = {
    groundingChunks: [{
      web: {
        title: "Public result",
        uri: "https://example.test/public-result",
      },
    }],
  };
  const runtime: PodcastAdkRuntime = {
    async *execute(input) {
      invoked = true;
      receivedModel = input.model;
      receivedPrompt = input.prompt;
      yield {
        invocationId: "adk-invocation-test",
        groundingMetadata: groundingMetadata as never,
        final: true,
      };
    },
  };

  const result = await runPodcastAdkResearch({
    query: "current entertainment format",
    windowLabel: "the past 7 days",
    googleDateOperators: "after:2026-09-02 before:2026-09-10",
    model: "gemini-3.6-flash",
  }, runtime);

  assert.equal(invoked, true);
  assert.equal(receivedModel, "gemini-3.6-flash");
  assert.match(receivedPrompt, /after:2026-09-02 before:2026-09-10/);
  assert.equal(result.execution.framework, podcastAdkFramework);
  assert.equal(result.execution.execution_id, "adk-invocation-test");
  assert.deepEqual(result.execution.tools, ["googleSearch"]);
  assert.equal(result.execution.status, "completed");
  assert.deepEqual(result.groundingMetadata, groundingMetadata);
  assert.equal("prompt" in result.execution, false);
  assert.equal("credentials" in result.execution, false);
});

test("podcast research fails closed with safe ADK failure evidence", async () => {
  const runtime: PodcastAdkRuntime = {
    async *execute() {
      yield {
        invocationId: "adk-invocation-failed",
        errorCode: "MODEL_ERROR",
        errorMessage: "Internal provider detail that must not be returned.",
        final: false,
      };
    },
  };

  await assert.rejects(
    () => runPodcastAdkResearch({
      query: "current entertainment format",
      windowLabel: "the past 24 hours",
      googleDateOperators: "after:2026-09-08 before:2026-09-10",
      model: "gemini-3.6-flash",
    }, runtime),
    (error) => {
      assert.ok(error instanceof PodcastAdkResearchError);
      assert.equal(error.message, "Google ADK grounded podcast research failed.");
      assert.equal(error.runtimeEvidence.framework, podcastAdkFramework);
      assert.equal(error.runtimeEvidence.execution_id, "adk-invocation-failed");
      assert.equal(error.runtimeEvidence.status, "failed");
      assert.equal(JSON.stringify(error.runtimeEvidence).includes("Internal provider detail"), false);
      return true;
    },
  );
});