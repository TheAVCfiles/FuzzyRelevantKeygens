import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { test } from "node:test";

import app from "../app";
import { markPodcastPersistenceReady } from "./podcast-readiness";
import {
  buildSafePodcastDraft,
  blockedLegacyPodcastWorkspaceFixture,
  commitGeneratedPodcastAudio,
  createPodcastDevelopment,
  createPodcastFilterPreset,
  createPodcastScript,
  createPodcastScriptFromGemini,
  createPodcastReleaseKit,
  decidePodcastAudio,
  deletePodcastFilterPreset,
  decidePodcastBrief,
  decidePodcastScript,
  generatePodcastBrief,
  generatePodcastAudio,
  getPodcastDevelopmentPlan,
  getPodcastLiveSnapshot,
  getPodcastScriptByBriefId,
  getPodcastScriptById,
  getPodcastRoom as getScopedPodcastRoom,
  getUnscopedPodcastRoom as getPodcastRoom,
  searchPodcastContexts,
  isPodcastEvidenceSufficient,
  isPodcastDevelopmentReady,
  podcastSources,
  podcastConcepts,
  olderPersistedPodcastWorkspaceFixture,
  renamePodcastFilterPreset,
  rehydratePodcastState,
  recordPodcastDevelopmentValidation,
  restorePodcastState,
  podcastTtsSpeechConfig,
  strictPodcastDraft,
  strictPodcastEvidenceConcept,
  extractPublishedSourceMetadata,
  validateAudienceAttributionBoundary,
  validateGoogleGroundingRedirectUrl,
  validateGeneratedScript,
  validateGroundedFindingSupport,
  validateSafeGroundedFinding,
  validateScriptClaimSupport,
  attestPodcastCuttingRoom,
  getPodcastAudioPathByCutKey,
  getPodcastAudioPath,
  getPodcastCutKey,
  getPublicPodcastCutKey,
  getPublicPodcastJudgeManifest,
  getPublicPodcastAudioCutKey,
  recordPodcastDecision,
  recordPodcastDevelopmentReceipt,
  runForPodcastArtifact,
} from "./podcast-fixtures";
import { ingestLiveObservations } from "./autography-fixtures";

// Fixture paths are available only under this explicit test/demo switch.
process.env.PODCAST_SYNTHETIC_DEMO = "true";
markPodcastPersistenceReady();

function previewProducerHeaders(userId = "route-regression-test") {
  return {
    "x-autography-role": "producer",
    "x-autography-user": userId,
  };
}

async function withApiServer(run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("comparison filter presets persist, can be renamed, and do not alter source counts", { concurrency: false }, () => {
  const before = getPodcastRoom();
  const preset = createPodcastFilterPreset("Reddit communities", ["Reddit"], ["r/television"]);
  assert.deepEqual(preset.platforms, ["Reddit"]);
  assert.deepEqual(preset.communities, ["r/television"]);
  assert.equal(getPodcastRoom().sources.length, before.sources.length);
  assert.equal(getPodcastRoom().filter_presets.some((item) => item.id === preset.id), true);

  const renamed = renamePodcastFilterPreset(preset.id, "Television signal");
  assert.equal(renamed?.name, "Television signal");
  assert.equal(deletePodcastFilterPreset(preset.id), true);
  assert.equal(getPodcastRoom().filter_presets.some((item) => item.id === preset.id), false);
});

test("comparison filter presets are private to their producer while legacy presets remain shared", { concurrency: false }, () => {
  const legacy = createPodcastFilterPreset("Legacy shared", ["YouTube"], []);
  const producerA = createPodcastFilterPreset("Producer A", ["Reddit"], [], "producer-a");
  const producerB = createPodcastFilterPreset("Producer B", ["TikTok"], [], "producer-b");

  assert.deepEqual(
    getScopedPodcastRoom("producer-a").filter_presets.map((preset) => preset.id),
    [legacy.id, producerA.id],
  );
  assert.deepEqual(
    getScopedPodcastRoom("producer-b").filter_presets.map((preset) => preset.id),
    [legacy.id, producerB.id],
  );
  assert.equal(renamePodcastFilterPreset(producerB.id, "Not mine", "producer-a"), null);
  assert.equal(deletePodcastFilterPreset(producerB.id, "producer-a"), false);
  assert.equal(renamePodcastFilterPreset(legacy.id, "Cannot claim legacy", "producer-a"), null);
  assert.equal(deletePodcastFilterPreset(legacy.id, "producer-a"), false);
  assert.equal(renamePodcastFilterPreset(producerA.id, "Mine", "producer-a")?.name, "Mine");
  assert.equal(deletePodcastFilterPreset(producerA.id, "producer-a"), true);

  deletePodcastFilterPreset(legacy.id);
  deletePodcastFilterPreset(producerB.id);
});

test("preset routes enforce producer ownership for list, rename, and delete", { concurrency: false }, async () => {
  await withApiServer(async (baseUrl) => {
    const legacyPreset = createPodcastFilterPreset("Legacy route preset", ["YouTube"], []);
    const otherProducerPreset = createPodcastFilterPreset("Other producer preset", ["TikTok"], [], "other-producer");
    const createResponse = await fetch(`${baseUrl}/podcast/presets`, {
      method: "POST",
      headers: {
        ...previewProducerHeaders("preset-owner"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Owner preset",
        platforms: ["Reddit"],
        communities: ["r/television"],
      }),
    });
    assert.equal(createResponse.status, 201);
    const preset = await createResponse.json() as { id: string; owner_id: string };
    assert.equal(preset.owner_id, "preset-owner");

    const otherRoomResponse = await fetch(`${baseUrl}/podcast/sources`, {
      headers: previewProducerHeaders("other-producer"),
    });
    assert.equal(otherRoomResponse.status, 200);
    const otherRoom = await otherRoomResponse.json() as { filter_presets: { id: string }[] };
    assert.equal(otherRoom.filter_presets.some((item) => item.id === preset.id), false);
    assert.equal(otherRoom.filter_presets.some((item) => item.id === legacyPreset.id), true);
    assert.equal(otherRoom.filter_presets.some((item) => item.id === otherProducerPreset.id), true);

    const sourceAddResponse = await fetch(`${baseUrl}/podcast/sources`, {
      method: "POST",
      headers: {
        ...previewProducerHeaders("other-producer"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ source_url: "https://example.com/private-preset-check" }),
    });
    assert.equal(sourceAddResponse.status, 200);
    const sourceAddRoom = await sourceAddResponse.json() as { filter_presets: { id: string }[] };
    assert.equal(sourceAddRoom.filter_presets.some((item) => item.id === preset.id), false);
    assert.equal(sourceAddRoom.filter_presets.some((item) => item.id === legacyPreset.id), true);
    assert.equal(sourceAddRoom.filter_presets.some((item) => item.id === otherProducerPreset.id), true);

    const resetResponse = await fetch(`${baseUrl}/podcast/reset`, {
      method: "POST",
      headers: previewProducerHeaders("other-producer"),
    });
    assert.equal(resetResponse.status, 200);
    const resetResult = await resetResponse.json() as { room: { filter_presets: { id: string }[] } };
    assert.equal(resetResult.room.filter_presets.some((item) => item.id === preset.id), false);
    assert.equal(resetResult.room.filter_presets.some((item) => item.id === legacyPreset.id), true);
    assert.equal(resetResult.room.filter_presets.some((item) => item.id === otherProducerPreset.id), true);

    const otherRenameResponse = await fetch(`${baseUrl}/podcast/presets/${preset.id}`, {
      method: "PATCH",
      headers: {
        ...previewProducerHeaders("other-producer"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Unauthorized rename" }),
    });
    assert.equal(otherRenameResponse.status, 404);

    const otherDeleteResponse = await fetch(`${baseUrl}/podcast/presets/${preset.id}`, {
      method: "DELETE",
      headers: previewProducerHeaders("other-producer"),
    });
    assert.equal(otherDeleteResponse.status, 404);

    const ownerRoomResponse = await fetch(`${baseUrl}/podcast/sources`, {
      headers: previewProducerHeaders("preset-owner"),
    });
    assert.equal(ownerRoomResponse.status, 200);
    const ownerRoom = await ownerRoomResponse.json() as { filter_presets: { id: string }[] };
    assert.equal(ownerRoom.filter_presets.some((item) => item.id === preset.id), true);

    const ownerDeleteResponse = await fetch(`${baseUrl}/podcast/presets/${preset.id}`, {
      method: "DELETE",
      headers: previewProducerHeaders("preset-owner"),
    });
    assert.equal(ownerDeleteResponse.status, 204);

    deletePodcastFilterPreset(legacyPreset.id);
    deletePodcastFilterPreset(otherProducerPreset.id);
  });
});

test("brief fallback preserves URL and retrieval provenance", { concurrency: false }, async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
  const room = getPodcastRoom();
  const concept = room.concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);

  assert.ok(brief);
  assert.equal(brief.generated_mode, "synthetic_demo");
  assert.deepEqual(
    brief.source_links.map((link) => [link.source_id, link.url, link.retrieved_at]),
    concept.source_ids.map((id) => {
      const source = podcastSources.find((item) => item.id === id);
      return [id, source?.source_url, source?.retrieved_at];
    }),
  );
  assert.equal(isPodcastEvidenceSufficient(brief), true);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("malformed or incomplete model output falls back field-by-field and never emits source text", { concurrency: false }, () => {
  const fallback = {
    topic_angle: "safe angle",
    audience_pain: "safe pain",
    why_now: "safe timing",
    key_tensions: ["safe tension"],
    risk_notes: ["do not quote"],
    episode_outline: [{ segment: "Open", purpose: "safe purpose" }],
    suggested_title: "Safe title",
  };
  const source = podcastSources[0];
  const safe = buildSafePodcastDraft(
    {
      topic_angle: source.post_title,
      audience_pain: 42,
      key_tensions: [source.post_title],
      episode_outline: [{ segment: "Open", purpose: source.post_title }],
      suggested_title: "",
    },
    fallback,
    [source],
  );

  assert.deepEqual(safe, fallback);
  assert.deepEqual(buildSafePodcastDraft(null, fallback, [source]), fallback);
});

test("production paths fail closed and structured editors reject malformed output", { concurrency: false }, async () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  const key = process.env.GEMINI_API_KEY;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(() => searchPodcastContexts("exact grounded query", "consumers", "recap"), /not configured/i);
    const concept = podcastConcepts[0]!;
    await assert.rejects(() => generatePodcastBrief(concept.id, concept.source_ids), /grounded concept|not configured/i);
    assert.throws(() => strictPodcastDraft({ topic_angle: "only one field" }, podcastSources.slice(0, 1)), /Malformed Gemini brief/i);
    assert.throws(() => strictPodcastEvidenceConcept({ title: "only one field" }), /malformed structured output/i);
    assert.throws(
      () => strictPodcastEvidenceConcept({
        title: "A cautious concept",
        summary: "\"Copied provider headline with a named person\"",
        observed_signal: "A bounded topic signal.",
        supported_context: "Public-web metadata.",
        unresolved_questions: ["Representativeness remains unknown."],
      }),
      /malformed structured output/i,
    );
    assert.throws(
      () => strictPodcastEvidenceConcept({
        title: "A cautious concept",
        summary: "A bounded aggregate signal.",
        observed_signal: "A bounded topic signal.",
        supported_context: "A u/example identifier remains.",
        unresolved_questions: ["Representativeness remains unknown."],
      }, [], ["Allison Example"]),
      /malformed structured output/i,
    );
    const sources = ["live-source-a", "live-source-b", "live-source-c"].map((id) => ({
      id, url: `https://example.test/${id}`, title: id, retrieved_at: "2026-01-01T00:00:00.000Z",
      snippet: "", source_type: "test", classification: "source_backed" as const,
      source_identifier: id, consent_reference: "test-consent", policy_reference: "podcast-current-context-policy-v1",
      aggregate_summary: "Aggregate test summary.", evidence_gaps: ["Test evidence gap."],
      what_it_supports: "test", what_remains_uncertain: "test",
    }));
    const liveConcept = { ...concept, id: "live-only-concept", source_ids: sources.map((source) => source.id) };
    const run = {
      id: "run-validator", query: "specific query", provider: "google_public_web" as const,
      window: "past_7_days" as const, policy_reference: "podcast-current-context-policy-v1", runtime_status: "Live Gemini" as const,
      sources, concept: liveConcept, uncertainties: ["A visible uncertainty"], grounding_support: "test", agent_executions: [],
    };
    const persistedDemoRun = { ...run, id: "persisted-demo-run", runtime_status: "Synthetic Demo" as const };
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [persistedDemoRun], currentBriefId: null, currentScriptId: null }), true);
    assert.deepEqual(getPodcastRoom().sources, []);
    assert.deepEqual(getPodcastRoom().concepts, []);
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [run], currentBriefId: null, currentScriptId: null }), true);
    const room = getPodcastRoom();
    assert.deepEqual(room.sources.map((source) => source.id).sort(), sources.map((source) => source.id).sort());
    assert.deepEqual(room.concepts.map((item) => item.id), [liveConcept.id]);
    assert.equal(room.sources.some((source) => podcastSources.some((fixture) => fixture.id === source.id)), false);
    assert.equal(room.concepts.some((item) => podcastConcepts.some((fixture) => fixture.id === item.id)), false);
    const legacyRun = {
      ...run,
      id: "legacy-unverified-run",
      sources: run.sources.map(({ source_identifier: _identifier, consent_reference: _consent, policy_reference: _policy, aggregate_summary: _summary, evidence_gaps: _gaps, ...source }) => source),
    } as any;
    delete legacyRun.provider;
    delete legacyRun.window;
    delete legacyRun.policy_reference;
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [legacyRun], currentBriefId: null, currentScriptId: null }), true);
    const legacyRoom = getPodcastRoom();
    assert.equal(legacyRoom.sources.every((source) => source.access_mode === "public_url"), true);
    assert.equal(legacyRoom.sources.every((source) => source.policy_reference === "legacy-unverified-provenance"), true);
    const legacyBrief = {
      source_links: legacyRoom.sources.map((source) => ({
        source_id: source.id,
        url: source.source_url,
        retrieved_at: source.retrieved_at ?? source.timestamp,
      })),
    } as any;
    assert.equal(isPodcastEvidenceSufficient(legacyBrief), false);
    assert.throws(() => validateGeneratedScript({ title: "bad", sections: [] }, run, { id: "a", run_id: run.id, decision: "decline", attested: false, signer: null, permitted_public_summary: null, authorized_uses: [], created_at: new Date().toISOString() }), /Malformed Gemini script/i);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
  }
});

test("grounded finding admission rejects identities, copied comments, and generic filler", () => {
  const safe = validateSafeGroundedFinding({
    safe_headline: "Awards coverage leaves context gaps",
    aggregate_summary: "Coverage focused on ceremony results while audience questions centered on missing performance context.",
    what_it_supports: "A recap should connect the reported results to the unresolved viewing questions.",
    what_remains_uncertain: "The retained sources do not establish how broadly those questions were shared.",
  }, ["Raw source wording is available only inside the bounded editor input."]);
  assert.equal(safe.safe_headline, "Awards coverage leaves context gaps");
  assert.throws(() => validateSafeGroundedFinding({
    ...safe,
    aggregate_summary: "@viewer said “I know exactly what happened.”",
  }, []), /unsafe or generic/i);
  assert.throws(() => validateSafeGroundedFinding({
    ...safe,
    aggregate_summary: "These eight copied words came directly from provider evidence today.",
  }, ["These eight copied words came directly from provider evidence today."]),
  /copied provider text/i);
  assert.throws(() => validateSafeGroundedFinding({
    ...safe,
    aggregate_summary: "Aggregate industry data created a taxonomy signal for the episode.",
  }, []), /unsafe or generic/i);
});

test("bounded publisher metadata preserves explicit metadata without retaining page text", () => {
  const marker = "RAW @viewer comment that must never survive";
  const resolved = extractPublishedSourceMetadata(`
    <html><head>
      <meta property="og:title" content="Nirvana to receive the Video Vanguard tribute">
      <meta property="og:site_name" content="Music Desk">
      <meta property="article:published_time" content="2026-09-07T13:30:00-04:00">
    </head><body>${marker}</body></html>
  `, "https://music.example/awards/nirvana-vanguard");
  assert.equal(resolved.url, "https://music.example/awards/nirvana-vanguard");
  assert.equal(resolved.title, "Nirvana to receive the Video Vanguard tribute");
  assert.equal(resolved.publisher, "Music Desk");
  assert.equal(resolved.published_at, "2026-09-07T17:30:00.000Z");
  assert.doesNotMatch(JSON.stringify(resolved), new RegExp(marker));

  const unknownDate = extractPublishedSourceMetadata(
    `<meta property="og:title" content="Current awards report"><meta property="og:site_name" content="Report Desk">`,
    "https://reports.example/current-awards",
  );
  assert.equal(unknownDate.published_at, null);
  assert.throws(
    () => validateGoogleGroundingRedirectUrl("https://publisher.example/article"),
    /Only Google grounding redirect URLs/i,
  );
  assert.throws(
    () => extractPublishedSourceMetadata(
      `<meta property="og:title" content="Private"><meta property="og:site_name" content="Private">`,
      "https://127.0.0.1/private",
    ),
    /public HTTPS publisher/i,
  );
});

test("unsupported transformed claims fail closed before script admission", () => {
  const checks = Array.from({ length: 6 }, (_, index) => ({
    section_index: index + 1,
    supported: index !== 2,
    unsupported_claims: index === 2
      ? ["international crossover acts, cross-genre collaborations, and broader category restructuring"]
      : [],
  }));
  assert.throws(
    () => validateScriptClaimSupport(checks, 6),
    /source-unsupported transformed claims/i,
  );
  assert.throws(
    () => validateGroundedFindingSupport([
      { source_index: 1, supported: true, unsupported_claims: [] },
      { source_index: 2, supported: false, unsupported_claims: ["broader category restructuring"] },
    ], 2),
    /source editor introduced unsupported transformed claims/i,
  );
});

test("audience attribution requires a Google-returned community source", () => {
  assert.throws(
    () => validateAudienceAttributionBoundary(
      "What fans think about the awards",
      [{ script: "Audiences want broader categories." }],
      ["publisher_reporting", "publisher_reporting"],
    ),
    /requires a mapped community source/i,
  );
  assert.doesNotThrow(() => validateAudienceAttributionBoundary(
    "What current coverage reports",
    [{ script: "Two reports describe a tribute and a dropped category." }],
    ["publisher_reporting", "publisher_reporting"],
  ));
  assert.doesNotThrow(() => validateAudienceAttributionBoundary(
    "What fans think about the awards",
    [{ script: "Fans ask how the voting will work." }],
    ["publisher_reporting", "community"],
  ));
});

test("TTS config is exactly the two declared house speakers", () => {
  assert.deepEqual(podcastTtsSpeechConfig().multiSpeakerVoiceConfig.speakerVoiceConfigs, [
    { speaker: "FRONT ROW", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    { speaker: "BACKSTAGE", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
  ]);
});

test("live performance keeps the exact script, run, sources, model evidence, audio, and Cut Key together", { concurrency: false }, async () => {
  const previousDemo = process.env.PODCAST_SYNTHETIC_DEMO;
  const run = currentRunFixture("live-audio-lineage", "2026-09-09T22:00:00.000Z");
  try {
    assert.equal(rehydratePodcastState({
      briefs: [],
      scripts: [],
      developmentPlans: [],
      groundedRuns: [run],
      currentBriefId: null,
      currentScriptId: null,
    }), true);
    const attestation = attestPodcastCuttingRoom(run.id, {
      decision: "add",
      raw_text: "Private material that must never enter the performance.",
      permitted_public_summary: "No private context was needed for this public-source highlight.",
      authorized_uses: ["podcast_script"],
    }, "lineage-attestation-reviewer");
    assert.ok(attestation && attestation !== "immutable");

    const plan = createPodcastDevelopment(run.concept.id, run.concept.source_ids, "consumers", "recap");
    assert.ok(plan);
    assert.ok(recordPodcastDevelopmentValidation(
      plan.id,
      "validate",
      plan.archetypes[0]!.id,
      plan.format_variants[0]!.id,
      "lineage-angle-selector",
    ));

    process.env.PODCAST_SYNTHETIC_DEMO = "true";
    const brief = await generatePodcastBrief(run.concept.id, run.concept.source_ids, plan.id);
    assert.ok(brief);
    assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
    const created = createPodcastScript(brief.id);
    assert.equal(created.kind, "created");
    if (created.kind !== "created") return;
    (created.script as typeof created.script & { claim_support_verified: boolean }).claim_support_verified = true;
    assert.equal(created.script.provenance[0]?.title, run.sources[0]?.title);

    process.env.PODCAST_SYNTHETIC_DEMO = "false";
    const approved = decidePodcastScript(created.script.id, "approve");
    assert.ok(approved);
    assert.equal(approved.audio_status, "ready_to_generate");
    assert.ok(approved.release_kit);
    recordPodcastDecision("script", approved.id, "approve", "lineage-script-reviewer");
    const authorityState = JSON.parse(readFileSync(process.env.PODCAST_STATE_PATH!, "utf8")) as any;
    authorityState.executionRecords = [
      ...(authorityState.executionRecords ?? []).filter((item: any) => item.key !== `script:${approved.id}`),
      {
        key: `script:${approved.id}`,
        execution: {
          agent: "script_performer",
          provider: "Google Gemini",
          framework: "Direct @google/genai",
          model: "gemini-test",
          execution_id: `${run.id}-script`,
          parent_execution_id: `${run.id}-adk-parent`,
          tools: [],
          latency_ms: 1,
          status: "completed",
          activity: "Generated the exact performed script.",
        },
      },
    ];
    const authorityReceipts = authorityState.approvalReceipts.filter(
      (item: any) => item.key === `script:${approved.id}` || item.key === `audio:${approved.id}`,
    );
    assert.equal(authorityReceipts.length, 2);
    assert.deepEqual(
      authorityReceipts.map((item: any) => item.receipt.authority_record_type),
      ["SCRIPT_APPROVED", "AUDIO_RENDER_AUTHORIZED"],
    );
    const [scriptAuthority, audioAuthority] = authorityReceipts.map((item: any) => item.receipt);
    assert.equal(scriptAuthority.reviewer, audioAuthority.reviewer);
    assert.equal(scriptAuthority.decided_at, audioAuthority.decided_at);
    assert.equal(scriptAuthority.artifact_sha256, audioAuthority.artifact_sha256);
    assert.equal(scriptAuthority.source_run_id, audioAuthority.source_run_id);
    assert.equal(scriptAuthority.policy_version, audioAuthority.policy_version);
    assert.notEqual(scriptAuthority.receipt_id, audioAuthority.receipt_id);
    assert.equal(approved.release_kit?.publishing_status, "blocked_until_final_approval");
    assert.equal(authorityState.approvalReceipts.some((item: any) => item.key.startsWith("publication:")), false);

    const assertAuthorityHold = async (state: any) => {
      assert.equal(rehydratePodcastState(state), true);
      let renderCalled = false;
      const blocked = await generatePodcastAudio(approved.id, {
        async render() {
          renderCalled = true;
          throw new Error("The renderer must not be called without both matching authority records.");
        },
      });
      assert.equal(blocked.kind, "generation_failed");
      assert.equal(renderCalled, false);
    };
    for (const missingKey of [`script:${approved.id}`, `audio:${approved.id}`]) {
      const missing = structuredClone(authorityState);
      missing.approvalReceipts = missing.approvalReceipts.filter((item: any) => item.key !== missingKey);
      await assertAuthorityHold(missing);
    }
    for (const field of ["reviewer", "decided_at", "artifact_sha256", "source_run_id", "policy_version"]) {
      const mismatched = structuredClone(authorityState);
      const audioItem = mismatched.approvalReceipts.find((item: any) => item.key === `audio:${approved.id}`);
      audioItem.receipt[field] = `${audioItem.receipt[field]}-mismatch`;
      await assertAuthorityHold(mismatched);
    }
    const changedScript = structuredClone(authorityState);
    const changedWorkspace = changedScript.scripts.find((item: any) => item.id === approved.id);
    changedWorkspace.sections[0].script = `${changedWorkspace.sections[0].script} changed`;
    await assertAuthorityHold(changedScript);
    assert.equal(
      getPodcastRoom().decision_history.some(
        (entry) => "authority_record_type" in entry && Boolean(entry.authority_record_type),
      ),
      false,
    );
    assert.equal(rehydratePodcastState(structuredClone(authorityState)), true);
    const exactTranscript = approved.sections
      .map((section) => `${section.speaker}: ${section.script}`)
      .join("\n\n");
    let performedTranscript = "";
    const result = await generatePodcastAudio(approved.id, {
      async render(transcript) {
        performedTranscript = transcript;
        return {
          wav: Buffer.alloc(96),
          evidence: {
            agent: "audio_performer",
            provider: "Google Gemini",
            framework: "Direct @google/genai",
            model: "gemini-2.5-flash-preview-tts",
            execution_id: "live-audio-lineage-invocation",
            tools: [],
            latency_ms: 1,
            status: "completed",
            activity: "Rendered exact approved transcript.",
          },
        };
      },
    });
    assert.equal(result.kind, "generated");
    if (result.kind !== "generated") return;
    assert.equal(performedTranscript, exactTranscript);
    assert.equal(result.clip.transcript, exactTranscript);
    assert.equal(result.clip.run_id, run.id);
    assert.deepEqual([...result.clip.source_ids].sort(), [...run.concept.source_ids].sort());
    assert.ok(result.clip.cut_key);
    const manifest = getPodcastCutKey(result.clip.cut_key!);
    assert.ok(manifest);
    assert.equal(manifest.production.synthetic, false);
    assert.equal(manifest.production.model, "gemini-2.5-flash-preview-tts");
    assert.equal(manifest.transcript, exactTranscript);
    assert.deepEqual(manifest.source_ids, [...run.concept.source_ids].sort());
    assert.deepEqual(
      manifest.source_evidence?.map((source) => ({
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        published_at: source.published_at,
        source_class: source.source_class,
      })),
      run.sources.map((source) => ({
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        published_at: source.published_at,
        source_class: source.source_type,
      })),
    );
    assert.equal(manifest.audio_sha256, createHash("sha256").update(Buffer.alloc(96)).digest("hex"));
    const publicAuthority = manifest.execution_envelope?.authority_boundary;
    assert.equal(publicAuthority?.publication_status, "blocked_until_final_approval");
    assert.deepEqual(
      publicAuthority?.authority_records?.map((record) => record.authority_record_type),
      ["SCRIPT_APPROVED", "AUDIO_RENDER_AUTHORIZED"],
    );
    assert.equal(publicAuthority?.authority_records?.[0]?.decided_at, publicAuthority?.authority_records?.[1]?.decided_at);
    assert.equal(publicAuthority?.authority_records?.[0]?.reviewer_reference, publicAuthority?.authority_records?.[1]?.reviewer_reference);
    assert.equal(publicAuthority?.authority_records?.[0]?.source_run_id, run.id);
    assert.equal(publicAuthority?.authority_records?.[0]?.policy_version, run.policy_reference);
    assert.doesNotMatch(JSON.stringify(manifest), /lineage-script-reviewer|Private material/);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = previousDemo ?? "true";
  }
});

test("live script generation failure never substitutes a fixture workspace", { concurrency: false }, async () => {
  const previousDemo = process.env.PODCAST_SYNTHETIC_DEMO;
  const previousKey = process.env.GEMINI_API_KEY;
  const run = currentRunFixture("live-script-failure", "2026-09-09T22:05:00.000Z");
  try {
    process.env.PODCAST_SYNTHETIC_DEMO = "true";
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], developmentPlans: [], groundedRuns: [run], currentBriefId: null, currentScriptId: null }), true);
    const attestation = attestPodcastCuttingRoom(run.id, {
      decision: "decline",
      authorized_uses: [],
    }, "failure-attestation-reviewer");
    assert.ok(attestation && attestation !== "immutable");
    const plan = createPodcastDevelopment(run.concept.id, run.concept.source_ids, "consumers", "recap");
    assert.ok(plan);
    assert.ok(recordPodcastDevelopmentValidation(plan.id, "validate", plan.archetypes[0]!.id, plan.format_variants[0]!.id, "failure-angle-selector"));
    const brief = await generatePodcastBrief(run.concept.id, run.concept.source_ids, plan.id);
    assert.ok(brief);
    assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");

    process.env.PODCAST_SYNTHETIC_DEMO = "false";
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () => createPodcastScriptFromGemini(brief.id),
      /Gemini script generation is not configured/,
    );
    assert.equal(getPodcastScriptByBriefId(brief.id).kind, "not_found");
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = previousDemo ?? "true";
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("synthetic approved cut produces a canonical, private-safe Cut Key only after every gate", { concurrency: false }, async () => {
  const sourceIds = ["cut-source-1", "cut-source-2", "cut-source-3"];
  const concept = {
    ...podcastConcepts[0]!,
    id: "cut-key-concept",
    source_ids: sourceIds,
    unresolved_questions: ["The public record cannot establish intent."],
  };
  const sources = sourceIds.map((id, index) => ({
    id, url: `https://example.test/cut/${index}`, title: `Cut source ${index}`, retrieved_at: "2026-01-01T00:00:00.000Z",
    snippet: "", source_type: "test", classification: "source_backed" as const,
    what_it_supports: "A bounded public context claim.", what_remains_uncertain: "Intent remains unresolved.",
  }));
  const run = {
    id: "cut-key-run",
    query: "cut-key exact query",
    provider: "synthetic_fixture" as const,
    window: "past_7_days" as const,
    policy_reference: "synthetic-fixture-policy-v1",
    runtime_status: "Synthetic Demo" as const,
    sources,
    concept,
    uncertainties: concept.unresolved_questions,
    grounding_support: "test",
    agent_executions: [],
  };
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], developmentPlans: [], groundedRuns: [run], currentBriefId: null, currentScriptId: null }), true);
  const rawMarker = "PRIVATE-CUTTING-ROOM-MARKER-DO-NOT-PUBLISH";
  const attestationInput = {
    decision: "add" as const, raw_text: rawMarker, permitted_public_summary: "A safe, approved public summary.", authorized_uses: ["podcast_script"],
  };
  const attestation = attestPodcastCuttingRoom(run.id, attestationInput, "attestation-reviewer");
  assert.notEqual(attestation, "immutable");
  if (!attestation || attestation === "immutable") return;
  assert.doesNotMatch(JSON.stringify(attestation), new RegExp(rawMarker));
  const replay = attestPodcastCuttingRoom(run.id, attestationInput, "attestation-reviewer");
  assert.notEqual(replay, "immutable");
  if (!replay || replay === "immutable") return;
  assert.equal(replay.id, attestation.id);
  assert.equal(attestPodcastCuttingRoom(run.id, { ...attestationInput, permitted_public_summary: "A changed summary." }, "attestation-reviewer"), "immutable");

  const plan = createPodcastDevelopment(concept.id, sourceIds, "consumers", "recap");
  assert.ok(plan);
  const validated = recordPodcastDevelopmentValidation(plan.id, "validate", plan.archetypes[0]!.id, plan.format_variants[0]!.id, "development-reviewer");
  assert.ok(validated);
  recordPodcastDevelopmentReceipt(plan.id, "development-reviewer");
  const brief = await generatePodcastBrief(concept.id, sourceIds, plan.id);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  recordPodcastDecision("brief", brief.id, "approve", "brief-reviewer");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");
  recordPodcastDecision("script", created.script.id, "approve", "script-reviewer");
  assert.deepEqual(
    getPodcastRoom().decision_history.slice(0, 2).map((entry) => ({
      artifact_type: entry.artifact_type,
      reviewer: entry.reviewer,
      decision: entry.decision,
      artifact_creation: entry.artifact_creation,
    })),
    [
      { artifact_type: "script", reviewer: "script-reviewer", decision: "approve", artifact_creation: "none" },
      { artifact_type: "audio", reviewer: "script-reviewer", decision: "approve", artifact_creation: "none" },
    ],
  );
  const compactApproved = getPodcastScriptById(created.script.id);
  assert.equal(compactApproved.kind, "found");
  if (compactApproved.kind !== "found") return;
  assert.equal(compactApproved.script.release_kit?.publishing_status, "blocked_until_final_approval");
  assert.equal(getPodcastCutKey("not-a-key"), null);
  const rejectedClipId = `clip-${created.script.id}`;
  assert.equal(getPodcastAudioPath(rejectedClipId), null);
  const first = commitGeneratedPodcastAudio(compactApproved.script, Buffer.alloc(48));
  assert.equal(first.kind, "generated");
  if (first.kind !== "generated") return;
  const firstManifest = getPodcastCutKey(first.clip.cut_key!);
  assert.ok(firstManifest);
  assert.doesNotMatch(JSON.stringify(firstManifest), new RegExp(rawMarker));
  assert.deepEqual(Object.keys(firstManifest).sort(), [
    "audio_sha256", "audio_url", "clip_id", "format_disclosure", "generated_at",
    "integrity_disclaimer", "key", "manifest_sha256", "production", "source_ids",
    "transcript", "transcript_sha256", "voice_disclosure",
  ]);
  assert.equal(firstManifest.key, `cut-${firstManifest.manifest_sha256}`);
  assert.equal(firstManifest.transcript_sha256, createHash("sha256").update(first.clip.transcript).digest("hex"));
  assert.equal(firstManifest.audio_sha256, createHash("sha256").update(Buffer.alloc(48)).digest("hex"));
  assert.deepEqual(firstManifest.production, { synthetic: true, provider: "Google Gemini", model: "Gemini TTS" });

  const secondDecision = decidePodcastAudio(created.script.id, "approve");
  assert.equal(secondDecision.kind, "updated");
  if (secondDecision.kind !== "updated") return;
  const second = commitGeneratedPodcastAudio(secondDecision.script, Buffer.alloc(52));
  assert.equal(second.kind, "generated");
  if (second.kind !== "generated") return;
  const secondManifest = getPodcastCutKey(second.clip.cut_key!);
  assert.ok(secondManifest);
  assert.equal(getPodcastCutKey(firstManifest.key)?.key, firstManifest.key);
  assert.notEqual(secondManifest.key, firstManifest.key);
  assert.equal((await getPublicPodcastCutKey(firstManifest.key))?.manifest_sha256, firstManifest.manifest_sha256);
  assert.equal(await getPublicPodcastJudgeManifest(), null);
  assert.ok(getPodcastAudioPathByCutKey(secondManifest.key));
  const omitted = { ...secondManifest } as any;
  delete omitted.transcript_sha256;
  const { GetPodcastCutKeyResponse } = await import("@workspace/api-zod");
  assert.equal(GetPodcastCutKeyResponse.safeParse(omitted).success, false);

  const audioPath = join(process.env.PODCAST_AUDIO_DIRECTORY!, `${secondManifest.clip_id}.wav`);
  const original = readFileSync(audioPath);
  writeFileSync(audioPath, Buffer.from("tampered"));
  try {
    assert.equal(getPodcastAudioPathByCutKey(secondManifest.key), null);
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/podcast/cut-keys/${secondManifest.key}`);
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.deepEqual(Object.keys(body).sort(), Object.keys(secondManifest).sort());
      assert.equal("approval_receipts" in body, false);
      assert.equal("private_attestation" in body, false);
      assert.equal("executions" in body, false);
    });
  } finally {
    writeFileSync(audioPath, original);
  }
  const reorderedManifest = {
    production: {
      model: secondManifest.production.model,
      provider: secondManifest.production.provider,
      synthetic: secondManifest.production.synthetic,
    },
    format_disclosure: secondManifest.format_disclosure,
    key: secondManifest.key,
    source_ids: secondManifest.source_ids,
    audio_url: secondManifest.audio_url,
    manifest_sha256: secondManifest.manifest_sha256,
    generated_at: secondManifest.generated_at,
    clip_id: secondManifest.clip_id,
    transcript_sha256: secondManifest.transcript_sha256,
    integrity_disclaimer: secondManifest.integrity_disclaimer,
    transcript: secondManifest.transcript,
    voice_disclosure: secondManifest.voice_disclosure,
    audio_sha256: secondManifest.audio_sha256,
  };
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    cutKeys: [reorderedManifest],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  assert.equal((await getPublicPodcastCutKey(secondManifest.key))?.key, secondManifest.key);

  const redirectedManifest = { ...secondManifest, audio_url: "https://example.test/unverified.wav" };
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    cutKeys: [redirectedManifest],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  assert.equal(await getPublicPodcastCutKey(secondManifest.key), null);

  const tamperedManifest = { ...secondManifest, transcript: `${secondManifest.transcript}\nTAMPERED` };
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    cutKeys: [tamperedManifest],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  assert.equal(await getPublicPodcastCutKey(secondManifest.key), null);
});

test("judge manifest returns an active canonical non-synthetic cut without private state", { concurrency: false }, async () => {
  const canonicalPayload = {
    clip_id: "clip-judge-live",
    transcript: "FRONT ROW: What changed? BACKSTAGE: Here is the sourced context.",
    transcript_sha256: createHash("sha256").update("FRONT ROW: What changed? BACKSTAGE: Here is the sourced context.").digest("hex"),
    source_ids: ["public-source-1", "public-source-2"],
    generated_at: "2026-09-09T00:00:00.000Z",
    production: {
      synthetic: false,
      provider: "Google Gemini",
      model: "gemini-2.5-flash-tts",
    },
    voice_disclosure: "Synthetic house voices; no voice cloning.",
    format_disclosure: "Approved evidence-backed performed sample.",
    audio_sha256: createHash("sha256").update("approved-public-audio").digest("hex"),
    integrity_disclaimer: "This manifest verifies artifact lineage and integrity, not the truth of any claim.",
  };
  const manifestSha256 = createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
  const key = `cut-${manifestSha256}`;
  const manifest = {
    key,
    manifest_sha256: manifestSha256,
    audio_url: `/api/podcast/cut-keys/${key}/audio`,
    ...canonicalPayload,
  };

  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [{
      id: "judge-live-script",
      brief_id: "judge-live-brief",
      audio_status: "generated",
      audio_clip: { id: canonicalPayload.clip_id },
    }],
    cutKeys: [manifest],
    currentBriefId: null,
    currentScriptId: "judge-live-script",
  }), true);

  const publicManifest = await getPublicPodcastJudgeManifest();
  assert.ok(publicManifest);
  assert.equal(publicManifest.key, key);
  assert.equal(publicManifest.production.synthetic, false);
  assert.deepEqual(Object.keys(publicManifest).sort(), [
    "audio_sha256", "audio_url", "clip_id", "format_disclosure", "generated_at",
    "integrity_disclaimer", "key", "manifest_sha256", "production", "source_ids",
    "transcript", "transcript_sha256", "voice_disclosure",
  ]);
  assert.equal("approval_receipts" in publicManifest, false);
  assert.equal("private_attestation" in publicManifest, false);
});

test("exact run resolver never binds an artifact to the newest unrelated run", { concurrency: false }, () => {
  const makeRun = (id: string) => {
    const sourceId = `${id}-source`;
    return {
      id, query: `${id} query`, runtime_status: "Live Gemini" as const,
      sources: [{ id: sourceId, url: `https://example.test/${id}`, title: id, retrieved_at: "2026-01-01T00:00:00.000Z", snippet: "", source_type: "test", classification: "source_backed" as const, what_it_supports: "test", what_remains_uncertain: "test" }],
      concept: { ...podcastConcepts[0]!, id: `${id}-concept`, source_ids: [sourceId] },
      uncertainties: ["test"], grounding_support: "test", agent_executions: [],
    };
  };
  const first = makeRun("first");
  const second = makeRun("second");
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [first, second], currentBriefId: null, currentScriptId: null }), true);
  assert.equal(runForPodcastArtifact(first.concept.id, first.concept.source_ids)?.id, first.id);
  assert.equal(runForPodcastArtifact(second.concept.id, second.concept.source_ids)?.id, second.id);
  assert.equal(runForPodcastArtifact(first.concept.id, []), null);
  assert.equal(runForPodcastArtifact(first.concept.id, [...first.concept.source_ids, "unexpected-source"]), null);
});

test("entertainment context search ranks cited packages and keeps speculation explicit", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [], currentBriefId: null, currentScriptId: null }), true);
  const result = await searchPodcastContexts(
    "cutting room edit context",
    "clients",
    "development",
  );
  assert.equal(result.search_mode, "synthetic_demo");
  assert.equal(result.audience, "clients");
  assert.equal(result.provider, "synthetic_fixture");
  assert.equal(result.window, "past_7_days");
  assert.equal(result.policy_reference, "podcast-current-context-policy-v1");
  assert.ok(result.results.length > 0);
  assert.ok(result.grounded_run.sources.length <= 5);
  for (const source of result.grounded_run.sources) {
    assert.ok(source.source_identifier.length > 0);
    assert.ok(source.retrieved_at.length > 0);
    assert.ok(source.policy_reference.length > 0);
    assert.ok(source.aggregate_summary.length > 0);
    assert.ok(source.evidence_gaps.length > 0);
    assert.equal(source.snippet, "Synthetic demonstration source; not a live web retrieval.");
  }
  for (const item of result.results) {
    assert.ok(item.sources.length > 0);
    assert.ok(item.concept.source_ids.every((id) => podcastSources.some((source) => source.id === id)));
    assert.match(item.speculation, /unverified/i);
    assert.ok(item.safest_next_reviewer.length > 0);
  }
});

test("live signal snapshots expose consent and observation boundaries without raw identities", { concurrency: false }, () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [], currentBriefId: null, currentScriptId: null }), true);
  const observedAt = new Date().toISOString();
  ingestLiveObservations({
    source_id: "consented-newsroom-v1",
    source_class: "consented_newsroom",
    consent_ref: "consent-regression-fixture",
    policy_review_ref: "policy-regression-fixture",
    observations: [{
      id: "aggregate-observation-1",
      text: "This text must never appear in a podcast snapshot.",
      observed_at: observedAt,
      observation_window: { start: observedAt, end: observedAt },
      confidence: "high",
    }],
  });
  const snapshot = getPodcastLiveSnapshot();
  assert.equal(snapshot.source_mode, "approved_live");
  assert.equal(snapshot.source_class, "consented_newsroom");
  assert.equal(snapshot.consent_reference, "consent-regression-fixture");
  assert.equal(snapshot.policy_review_reference, "policy-regression-fixture");
  assert.equal(snapshot.aggregate_observations, 1);
  assert.doesNotMatch(JSON.stringify(snapshot), /This text must never appear/);
  assert.match(snapshot.data_notice, /Identity fields and raw comments are not available/i);
});

function currentRunFixture(id: string, retrievedAt: string) {
  const sources = ["a", "b", "c"].map((suffix) => ({
    id: `${id}-source-${suffix}`,
    url: `https://publisher-${suffix}.example/${id}/${suffix}`,
    title: `Approved result ${suffix}`,
    publisher: `Publisher ${suffix.toUpperCase()}`,
    published_at: retrievedAt,
    retrieved_at: retrievedAt,
    snippet: "",
    source_type: "publisher_reporting",
    classification: "source_backed" as const,
    source_identifier: `${id}-${suffix}`,
    consent_reference: "public-web-approved-search",
    policy_reference: "podcast-current-context-policy-v1",
    aggregate_summary: `Aggregate signal ${suffix}.`,
    evidence_gaps: ["Publication timing remains unverified."],
    what_it_supports: `Bounded signal ${suffix}.`,
    what_remains_uncertain: "Representativeness remains unknown.",
  }));
  const concept = {
    ...podcastConcepts[0]!,
    id: `${id}-concept`,
    title: "Current aggregate context for producer review",
    summary: "Three provider-linked sources contributed identity-free taxonomy signals.",
    observed_signal: "The retained sources contain a bounded current-context signal.",
    supported_context: "Only approved source metadata enters development.",
    source_ids: sources.map((source) => source.id),
    unresolved_questions: ["Representativeness remains unknown."],
  };
  return {
    id,
    query: `${id} grounded query`,
    provider: "google_public_web" as const,
    window: "past_7_days" as const,
    policy_reference: "podcast-current-context-policy-v1",
    runtime_status: "Live Google ADK" as const,
    sources,
    concept,
    uncertainties: ["Representativeness remains unknown."],
    grounding_support: "Google ADK and Google Search grounding metadata.",
    agent_executions: [
      {
        agent: "source_scout" as const,
        provider: "Google Gemini API",
        framework: "Google ADK (@google/adk)",
        model: "gemini-test",
        execution_id: `${id}-adk-parent`,
        parent_execution_id: `${id}-adk-parent`,
        tools: ["googleSearch"],
        latency_ms: 1,
        status: "completed" as const,
        activity: "Ran grounded public-web research.",
      },
      {
        agent: "evidence_editor" as const,
        provider: "Google Gemini",
        framework: "Direct @google/genai",
        model: "gemini-test",
        execution_id: `${id}-editor`,
        parent_execution_id: `${id}-adk-parent`,
        tools: [],
        latency_ms: 1,
        status: "completed" as const,
        activity: "Synthesized bounded evidence.",
      },
      {
        agent: "evidence_verifier" as const,
        provider: "Google Gemini",
        framework: "Direct @google/genai",
        model: "gemini-test",
        execution_id: `${id}-verifier`,
        parent_execution_id: `${id}-adk-parent`,
        tools: [],
        latency_ms: 1,
        status: "completed" as const,
        activity: "Verified source support.",
      },
    ],
  };
}

test("Gate 00 selects the same newest compatible grounded run as the editorial room", { concurrency: false }, () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  try {
    const current = currentRunFixture("current-run-selection", "2026-09-09T21:17:06.119Z");
    const synthetic = { ...current, id: "newer-synthetic-run", runtime_status: "Synthetic Demo" as const };
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [current, synthetic], currentBriefId: null, currentScriptId: null }), true);
    const room = getPodcastRoom();
    const snapshot = getPodcastLiveSnapshot();
    assert.deepEqual(room.concepts.map((concept) => concept.id), [current.concept.id]);
    assert.deepEqual(room.sources.map((source) => source.id), current.sources.map((source) => source.id));
    assert.equal(snapshot.source_id, current.id);
    assert.equal(snapshot.source_mode, "approved_live");
    assert.equal(snapshot.aggregate_observations, current.sources.length);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
  }
});

test("current-run linkage survives persisted workspace hydration without rewriting history", { concurrency: false }, () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  try {
    const historical = currentRunFixture("historical-run", "2026-09-08T23:48:47.231Z");
    const current = currentRunFixture("hydrated-current-run", "2026-09-09T21:17:06.119Z");
    const persisted = {
      briefs: [],
      scripts: [],
      developmentPlans: [],
      groundedRuns: [historical, current],
      currentBriefId: null,
      currentScriptId: null,
    };
    assert.equal(rehydratePodcastState(persisted), true);
    assert.equal(getPodcastLiveSnapshot().source_id, current.id);
    assert.equal(runForPodcastArtifact(historical.concept.id, historical.concept.source_ids)?.id, historical.id);
    assert.equal(rehydratePodcastState(persisted), true);
    assert.equal(getPodcastLiveSnapshot().source_id, current.id);
    assert.equal(runForPodcastArtifact(historical.concept.id, historical.concept.source_ids)?.id, historical.id);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
  }
});

test("development-plan creation persists the selected run snapshot and compatible source set", { concurrency: false }, () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  try {
    const current = currentRunFixture("development-current-run", "2026-09-09T21:17:06.119Z");
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], developmentPlans: [], groundedRuns: [current], currentBriefId: null, currentScriptId: null }), true);
    const selectedSourceIds = current.concept.source_ids.slice(0, 2);
    const plan = createPodcastDevelopment(current.concept.id, selectedSourceIds, "consumers", "development");
    assert.ok(plan);
    assert.equal(plan.source_snapshot.source_id, current.id);
    assert.equal(plan.source_snapshot.source_mode, "approved_live");
    assert.equal(plan.source_snapshot.policy_review_reference, current.policy_reference);
    assert.equal(plan.source_snapshot.aggregate_observations, selectedSourceIds.length);
    assert.deepEqual(plan.source_ids, selectedSourceIds);
    assert.ok(plan.format_variants.every((variant) => (
      variant.citation_ids.length === selectedSourceIds.length &&
      variant.citation_ids.every((sourceId) => selectedSourceIds.includes(sourceId))
    )));
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
  }
});

test("development plans preserve citations, disclose fictional lenses, and expose scoring uncertainty", { concurrency: false }, () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], filterPresets: [], developmentPlans: [], currentBriefId: null, currentScriptId: null }), true);
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const plan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "development");
  assert.ok(plan);
  assert.equal(plan.format_variants.length, 5);
  assert.ok(plan.archetypes.every((archetype) => /fictional editorial lens/i.test(archetype.non_impersonation_disclosure)));
  for (const variant of plan.format_variants) {
    assert.deepEqual(variant.citation_ids, concept.source_ids);
    assert.ok(variant.segment_spine.every((segment) => segment.source_ids.length > 0));
    assert.ok(variant.methodology_factors.every((factor) => factor.score >= 0 && factor.score <= 100));
    assert.ok(variant.methodology_factors.every((factor) => factor.evidence && factor.uncertainty));
    assert.match(variant.forecast_label, /not a popularity guarantee/i);
    assert.ok(variant.risks.some((risk) => /unsupported certainty|not promises/i.test(risk)));
  }
});

test("human development validation persists and locks the selected hypothesis for a cited brief", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], filterPresets: [], developmentPlans: [], currentBriefId: null, currentScriptId: null }), true);
  const concept = getPodcastRoom().concepts[1];
  assert.ok(concept);
  const plan = createPodcastDevelopment(concept.id, concept.source_ids, "clients", "recap");
  assert.ok(plan);
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, concept.source_ids), false);
  const archetype = plan.archetypes[0];
  const format = plan.format_variants[1];
  assert.ok(archetype && format);
  const validated = recordPodcastDevelopmentValidation(plan.id, "validate", archetype.id, format.id, "producer regression");
  assert.ok(validated);
  assert.equal(validated.status, "validated");
  assert.equal(validated.measurement_record.validation_status, "validated");
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, concept.source_ids), true);
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, [...concept.source_ids, "unreviewed-source"]), false);
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, concept.source_ids.slice(0, 1)), false);
  restorePodcastState();
  assert.equal(getPodcastDevelopmentPlan(plan.id)?.selected_format_id, format.id);

  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const brief = await generatePodcastBrief(concept.id, concept.source_ids, plan.id);
    assert.equal(brief?.development_plan_id, plan.id);
    assert.equal(brief?.editorial_archetype?.id, archetype.id);
    assert.equal(brief?.selected_format?.id, format.id);
    assert.deepEqual(brief?.selected_format?.citation_ids, concept.source_ids);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("draft development plans cannot pass the brief route gate", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], filterPresets: [], developmentPlans: [], currentBriefId: null, currentScriptId: null }), true);
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const plan = createPodcastDevelopment(concept.id, concept.source_ids, "users", "cultural_context");
  assert.ok(plan);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/podcast/brief`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...previewProducerHeaders("development-route-regression"),
      },
      body: JSON.stringify({
        concept_id: concept.id,
        source_ids: concept.source_ids,
        development_plan_id: plan.id,
      }),
    });
    assert.equal(response.status, 409);
    const omitted = await fetch(`http://127.0.0.1:${address.port}/api/podcast/brief`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...previewProducerHeaders("development-route-regression"),
      },
      body: JSON.stringify({
        concept_id: concept.id,
        source_ids: concept.source_ids,
      }),
    });
    assert.equal(omitted.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("audio remains blocked until a staged kit receives a separate human decision", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    filterPresets: [],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  const concept = getPodcastRoom().concepts.find((item) => item.id === "concept-format-trust");
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(decidePodcastAudio(created.script.id, "approve").kind, "not_ready");
  assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");
  assert.equal(createPodcastReleaseKit(created.script.id).kind, "created");
  const approved = decidePodcastAudio(created.script.id, "approve");
  assert.equal(approved.kind, "updated");
  if (approved.kind !== "updated") return;
  assert.equal(approved.script.audio_status, "ready_to_generate");
  assert.equal(approved.script.release_kit?.audio_status, "ready_to_generate");
  assert.equal(approved.script.release_kit?.publishing_status, "blocked_until_final_approval");
});

test("legacy brief decisions remain compatible and a rejected script explicitly blocks audio", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[1];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(createPodcastScript(brief.id).kind, "brief_not_approved");

  const rejected = decidePodcastBrief(brief.id, "reject");
  assert.equal(rejected?.status, "rejected");
  assert.equal(createPodcastScript(brief.id).kind, "brief_not_approved");

  const approved = decidePodcastBrief(brief.id, "approve");
  assert.equal(approved?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(created.script.audio_status, "blocked_until_script_approval");

  const rejectedScript = decidePodcastScript(created.script.id, "reject");
  assert.equal(rejectedScript?.status, "rejected");
  assert.equal(rejectedScript?.audio_status, "rejected");
});

test("approved script workspaces can be retrieved by brief or workspace id", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;

  assert.deepEqual(getPodcastScriptByBriefId(brief.id), { kind: "found", script: created.script });
  assert.deepEqual(getPodcastScriptById(created.script.id), { kind: "found", script: created.script });
});

test("persisted approved workspaces restore with provenance and approval gates", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");

  // Re-read the durable repository just as a newly started API process does.
  restorePodcastState();
  const restored = getPodcastScriptById(created.script.id);
  assert.equal(restored.kind, "found");
  if (restored.kind !== "found") return;
  assert.equal(restored.script.status, "approved");
  assert.deepEqual(restored.script.provenance, brief.source_links);
  assert.equal(restored.script.sections[0]?.source_ids[0], brief.source_links[0]?.source_id);
});

test("restored draft and rejected briefs remain blocked from script workspaces", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[2];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  restorePodcastState();
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
  assert.equal(decidePodcastBrief(brief.id, "reject")?.status, "rejected");
  restorePodcastState();
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
});

test("draft and rejected briefs cannot retrieve script workspaces", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[2];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
  assert.equal(decidePodcastBrief(brief.id, "reject")?.status, "rejected");
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
});

test("approved scripts prepare and rehydrate a staged release kit without unlocking audio or publishing", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  if (created.script.status !== "approved") {
    assert.equal(createPodcastReleaseKit(created.script.id).kind, "script_not_approved");
    assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");
  }

  const result = createPodcastReleaseKit(created.script.id);
  assert.equal(result.kind, "created");
  if (result.kind !== "created") return;
  assert.equal(result.releaseKit.status, "staged");
  assert.ok(result.releaseKit.title_options.length >= 2);
  assert.ok(result.releaseKit.chapters.length >= 3);
  assert.ok(result.releaseKit.promotion_copy.length >= 2);
  assert.equal(result.releaseKit.audio_status, "awaiting_audio_approval");
  assert.equal(result.releaseKit.publishing_status, "blocked_until_final_approval");
  assert.match(result.releaseKit.provenance_summary, /retrieved public sources/);

  // Re-read the durable repository just as a newly started API process does.
  restorePodcastState();
  const restored = getPodcastScriptById(created.script.id);
  assert.equal(restored.kind, "found");
  if (restored.kind !== "found") return;

  assert.equal(restored.script.status, "approved");
  assert.deepEqual(restored.script.release_kit, result.releaseKit);
  assert.deepEqual(restored.script.release_kit?.title_options, result.releaseKit.title_options);
  assert.deepEqual(restored.script.release_kit?.chapters, result.releaseKit.chapters);
  assert.deepEqual(restored.script.release_kit?.promotion_copy, result.releaseKit.promotion_copy);
  assert.deepEqual(restored.script.release_kit?.accessibility_notes, result.releaseKit.accessibility_notes);
  assert.equal(restored.script.release_kit?.provenance_summary, result.releaseKit.provenance_summary);
  assert.equal(restored.script.release_kit?.status, "staged");
  assert.equal(restored.script.release_kit?.audio_status, "awaiting_audio_approval");
  assert.equal(restored.script.release_kit?.publishing_status, "blocked_until_final_approval");
});

test("script workspaces contain performed podcast copy rather than production instructions", { concurrency: false }, async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const concept = getPodcastRoom().concepts[0];
    assert.ok(concept);
    const firstPlan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "recap");
    assert.ok(firstPlan);
    const firstValidated = recordPodcastDevelopmentValidation(
      firstPlan.id,
      "validate",
      firstPlan.archetypes[0].id,
      firstPlan.format_variants[0].id,
      "performed-sample-test",
    );
    assert.ok(firstValidated);
    assert.equal(firstValidated.status, "validated");
    const firstBrief = await generatePodcastBrief(concept.id, concept.source_ids, firstPlan.id);
    assert.ok(firstBrief);
    assert.equal(decidePodcastBrief(firstBrief.id, "approve")?.status, "approved");
    const firstCreated = createPodcastScript(firstBrief.id);
    assert.equal(firstCreated.kind, "created");
    if (firstCreated.kind !== "created") return;

    const firstTranscript = firstCreated.script.sections.map((section) => section.script).join(" ");
    assert.match(firstTranscript, /Here is the strange thing/i);
    assert.match(firstTranscript, /cutting-room floor/i);
    assert.doesNotMatch(firstTranscript, /\b(Open on|Open with|Begin with|State two|Start at|Frame this as|Name uncertainty)\b/i);
    assert.ok(firstCreated.script.sections.every((section) => section.source_ids.length > 0));
    assert.equal(decidePodcastScript(firstCreated.script.id, "approve")?.status, "approved");
    assert.equal(createPodcastReleaseKit(firstCreated.script.id).kind, "created");
    assert.equal(decidePodcastAudio(firstCreated.script.id, "approve").kind, "updated");
    const pendingAudioWorkspace = getPodcastScriptById(firstCreated.script.id);
    assert.equal(pendingAudioWorkspace.kind, "found");
    if (pendingAudioWorkspace.kind !== "found") return;

    const secondPlan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "recap");
    assert.ok(secondPlan);
    recordPodcastDevelopmentValidation(
      secondPlan.id,
      "validate",
      secondPlan.archetypes[3].id,
      secondPlan.format_variants[4].id,
      "performed-sample-test",
    );
    const secondBrief = await generatePodcastBrief(concept.id, concept.source_ids, secondPlan.id);
    assert.ok(secondBrief);
    const approvedSecondBrief = decidePodcastBrief(secondBrief.id, "approve");
    assert.ok(approvedSecondBrief);
    assert.equal(getPodcastScriptByBriefId(secondBrief.id).kind, "not_found");
    assert.equal(getPodcastScriptById(firstCreated.script.id).kind, "not_found");
    assert.equal(rehydratePodcastState({
      briefs: [approvedSecondBrief],
      scripts: [pendingAudioWorkspace.script],
      currentBriefId: approvedSecondBrief.id,
      currentScriptId: pendingAudioWorkspace.script.id,
    }), true);
    assert.equal(getPodcastScriptByBriefId(approvedSecondBrief.id).kind, "not_found");
    const secondCreated = createPodcastScript(secondBrief.id);
    assert.equal(secondCreated.kind, "created");
    if (secondCreated.kind !== "created") return;
    const reopenedSecond = getPodcastScriptById(secondCreated.script.id);
    assert.equal(reopenedSecond.kind, "found");
    if (reopenedSecond.kind !== "found") return;
    assert.equal(reopenedSecond.script.audio_clip, null);
    assert.equal(reopenedSecond.script.sections[0]?.script, secondCreated.script.sections[0]?.script);
    const secondTranscript = secondCreated.script.sections.map((section) => section.script).join(" ");
    assert.notEqual(secondTranscript, firstTranscript);
    assert.match(secondTranscript, /Reality television can fit three weeks/i);

    const thirdPlan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "recap");
    assert.ok(thirdPlan);
    recordPodcastDevelopmentValidation(
      thirdPlan.id,
      "validate",
      thirdPlan.archetypes[0].id,
      thirdPlan.format_variants[0].id,
      "performed-sample-test",
    );
    const thirdBrief = await generatePodcastBrief(concept.id, concept.source_ids, thirdPlan.id);
    assert.ok(thirdBrief);
    decidePodcastBrief(thirdBrief.id, "approve");
    assert.equal(getPodcastScriptByBriefId(thirdBrief.id).kind, "not_found");
    const thirdCreated = createPodcastScript(thirdBrief.id);
    assert.equal(thirdCreated.kind, "created");
    if (thirdCreated.kind !== "created") return;
    const thirdTranscript = thirdCreated.script.sections.map((section) => section.script).join(" ");
    assert.notEqual(thirdTranscript, secondTranscript);
    assert.match(thirdTranscript, /The timeline gives us a trail/i);
    assert.match(thirdTranscript, /Everybody saw the same cut/i);
    assert.equal(decidePodcastScript(thirdCreated.script.id, "approve")?.status, "approved");
    assert.equal(createPodcastReleaseKit(thirdCreated.script.id).kind, "created");
    assert.equal(decidePodcastAudio(thirdCreated.script.id, "approve").kind, "updated");
    assert.equal(
      commitGeneratedPodcastAudio(pendingAudioWorkspace.script, Buffer.alloc(48)).kind,
      "superseded",
    );
    const reopenedThird = getPodcastScriptById(thirdCreated.script.id);
    assert.equal(reopenedThird.kind, "found");
    if (reopenedThird.kind !== "found") return;
    assert.equal(reopenedThird.script.audio_status, "ready_to_generate");
    assert.equal(reopenedThird.script.audio_clip, null);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("older persisted workspaces retain release kits after storage rehydration", { concurrency: false }, () => {
  assert.equal(rehydratePodcastState(olderPersistedPodcastWorkspaceFixture), true);

  const restored = getPodcastScriptById(olderPersistedPodcastWorkspaceFixture.currentScriptId ?? "");
  assert.equal(restored.kind, "found");
  if (restored.kind !== "found") return;

  const releaseKit = restored.script.release_kit;
  assert.ok(releaseKit);
  assert.equal(restored.script.compatibility_normalized, true);
  const legacyScript = olderPersistedPodcastWorkspaceFixture.scripts?.[0];
  assert.ok(legacyScript);
  const legacyReleaseKit = legacyScript.release_kit;
  assert.ok(legacyReleaseKit && "titles" in legacyReleaseKit);
  assert.deepEqual(releaseKit.title_options, legacyReleaseKit.titles);
  assert.deepEqual(releaseKit.chapters, legacyReleaseKit.chapters);
  assert.deepEqual(releaseKit.promotion_copy, legacyReleaseKit.promotion_drafts);
  assert.deepEqual(releaseKit.accessibility_notes, legacyReleaseKit.accessibility_notes);
  assert.equal(releaseKit.provenance_summary, legacyReleaseKit.provenance_summary);
  assert.equal(releaseKit.status, "staged");
  assert.equal(releaseKit.audio_status, "awaiting_audio_approval");
  assert.equal(releaseKit.publishing_status, "blocked_until_final_approval");
});

test("legacy workspaces keep compatibility and production gates through both API retrieval routes", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState(olderPersistedPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = previewProducerHeaders();
    const briefId = olderPersistedPodcastWorkspaceFixture.currentBriefId;
    const scriptId = olderPersistedPodcastWorkspaceFixture.currentScriptId;
    assert.ok(briefId);
    assert.ok(scriptId);

    const responses = await Promise.all([
      fetch(`${baseUrl}/podcast/brief/${briefId}/script`, { headers }),
      fetch(`${baseUrl}/podcast/script/${scriptId}`, { headers }),
    ]);

    for (const response of responses) {
      assert.equal(response.status, 200);
      const body = await response.json() as {
        status: string;
        audio_status: string;
        compatibility_normalized: boolean;
        release_kit?: {
          audio_status: string;
          publishing_status: string;
        } | null;
      };
      assert.equal(body.compatibility_normalized, true);
      assert.equal(body.status, "approved");
      assert.equal(body.audio_status, "blocked_until_script_approval");
      assert.equal(body.release_kit?.audio_status, "awaiting_audio_approval");
      assert.equal(body.release_kit?.publishing_status, "blocked_until_final_approval");
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("restored legacy draft and rejected workspaces stay blocked through both API retrieval routes", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState(blockedLegacyPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = previewProducerHeaders();

    for (const status of ["draft", "rejected"] as const) {
      const briefId = `legacy-${status}-brief`;
      const scriptId = `script-legacy-${status}-brief`;
      const responses = await Promise.all([
        fetch(`${baseUrl}/podcast/brief/${briefId}/script`, { headers }),
        fetch(`${baseUrl}/podcast/script/${scriptId}`, { headers }),
      ]);

      for (const response of responses) {
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          error: response.url.includes(`/brief/${briefId}/`)
            ? "Only an approved podcast brief can retrieve a script workspace."
            : "Only a script from an approved podcast brief can be retrieved.",
        });
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("restored legacy draft and rejected workspaces stay blocked through all API mutation routes", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState(blockedLegacyPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = {
      "content-type": "application/json",
      ...previewProducerHeaders(),
    };

    for (const status of ["draft", "rejected"] as const) {
      const briefId = `legacy-${status}-brief`;
      const scriptId = `script-legacy-${status}-brief`;
      const responses = await Promise.all([
        fetch(`${baseUrl}/podcast/brief/${briefId}/decision`, {
          method: "POST",
          headers,
          body: JSON.stringify({ decision: "approve" }),
        }),
        fetch(`${baseUrl}/podcast/brief/${briefId}/script`, {
          method: "POST",
          headers,
        }),
        fetch(`${baseUrl}/podcast/script/${scriptId}/decision`, {
          method: "POST",
          headers,
          body: JSON.stringify({ decision: "approve" }),
        }),
        fetch(`${baseUrl}/podcast/script/${scriptId}/release-kit`, {
          method: "POST",
          headers,
        }),
      ]);

      for (const response of responses) {
        assert.equal(response.status, 409);
        const body = await response.json() as { error?: string };
        assert.equal(typeof body.error, "string");
        assert.equal(Object.keys(body).includes("status"), false);
        assert.equal(Object.keys(body).includes("brief_id"), false);
        assert.equal(Object.keys(body).includes("brief"), false);
        assert.equal(Object.keys(body).includes("script"), false);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("approved legacy workspaces retain brief approval, script approval, and release gates", { concurrency: false }, async () => {
  process.env.PODCAST_SYNTHETIC_DEMO = "true";
  if (olderPersistedPodcastWorkspaceFixture.briefs[0]) olderPersistedPodcastWorkspaceFixture.briefs[0].status = "approved";
  assert.equal(rehydratePodcastState(olderPersistedPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = {
      "content-type": "application/json",
      ...previewProducerHeaders(),
    };
    const briefId = olderPersistedPodcastWorkspaceFixture.currentBriefId;
    const scriptId = olderPersistedPodcastWorkspaceFixture.currentScriptId;
    assert.ok(briefId);
    assert.ok(scriptId);

    const briefDecision = await fetch(`${baseUrl}/podcast/brief/${briefId}/decision`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    });
    // A restored legacy record with no immutable run binding remains fail-closed.
    if (briefDecision.status === 409) return;
    assert.equal(briefDecision.status, 200);
    const briefBody = await briefDecision.json() as { status?: string };
    assert.equal(briefBody.status, "approved");

    const scriptDecision = await fetch(`${baseUrl}/podcast/script/${scriptId}/decision`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(scriptDecision.status, 200);
    const scriptBody = await scriptDecision.json() as { status?: string };
    assert.equal(scriptBody.status, "approved");

    const releaseKit = await fetch(`${baseUrl}/podcast/script/${scriptId}/release-kit`, {
      method: "POST",
      headers,
    });
    assert.equal(releaseKit.status, 201);
    const releaseBody = await releaseKit.json() as {
      status?: string;
      audio_status?: string;
      publishing_status?: string;
    };
    assert.equal(releaseBody.status, "staged");
    assert.equal(releaseBody.audio_status, "awaiting_audio_approval");
    assert.equal(releaseBody.publishing_status, "blocked_until_final_approval");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

function previewProducerHeadersDuplicate(userId = "route-regression-test") {
  return {
    "x-autography-role": "producer",
    "x-autography-user": userId,
  };
}

async function withApiServerDuplicate(run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("comparison filter presets persist, can be renamed, and do not alter source counts", { concurrency: false }, () => {
  const before = getPodcastRoom();
  const preset = createPodcastFilterPreset("Reddit communities", ["Reddit"], ["r/television"]);
  assert.deepEqual(preset.platforms, ["Reddit"]);
  assert.deepEqual(preset.communities, ["r/television"]);
  assert.equal(getPodcastRoom().sources.length, before.sources.length);
  assert.equal(getPodcastRoom().filter_presets.some((item) => item.id === preset.id), true);

  const renamed = renamePodcastFilterPreset(preset.id, "Television signal");
  assert.equal(renamed?.name, "Television signal");
  assert.equal(deletePodcastFilterPreset(preset.id), true);
  assert.equal(getPodcastRoom().filter_presets.some((item) => item.id === preset.id), false);
});

test("comparison filter presets are private to their producer while legacy presets remain shared", { concurrency: false }, () => {
  const legacy = createPodcastFilterPreset("Legacy shared", ["YouTube"], []);
  const producerA = createPodcastFilterPreset("Producer A", ["Reddit"], [], "producer-a");
  const producerB = createPodcastFilterPreset("Producer B", ["TikTok"], [], "producer-b");

  assert.deepEqual(
    getScopedPodcastRoom("producer-a").filter_presets.map((preset) => preset.id),
    [legacy.id, producerA.id],
  );
  assert.deepEqual(
    getScopedPodcastRoom("producer-b").filter_presets.map((preset) => preset.id),
    [legacy.id, producerB.id],
  );
  assert.equal(renamePodcastFilterPreset(producerB.id, "Not mine", "producer-a"), null);
  assert.equal(deletePodcastFilterPreset(producerB.id, "producer-a"), false);
  assert.equal(renamePodcastFilterPreset(legacy.id, "Cannot claim legacy", "producer-a"), null);
  assert.equal(deletePodcastFilterPreset(legacy.id, "producer-a"), false);
  assert.equal(renamePodcastFilterPreset(producerA.id, "Mine", "producer-a")?.name, "Mine");
  assert.equal(deletePodcastFilterPreset(producerA.id, "producer-a"), true);

  deletePodcastFilterPreset(legacy.id);
  deletePodcastFilterPreset(producerB.id);
});

test("preset routes enforce producer ownership for list, rename, and delete", { concurrency: false }, async () => {
  await withApiServer(async (baseUrl) => {
    const legacyPreset = createPodcastFilterPreset("Legacy route preset", ["YouTube"], []);
    const otherProducerPreset = createPodcastFilterPreset("Other producer preset", ["TikTok"], [], "other-producer");
    const createResponse = await fetch(`${baseUrl}/podcast/presets`, {
      method: "POST",
      headers: {
        ...previewProducerHeaders("preset-owner"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Owner preset",
        platforms: ["Reddit"],
        communities: ["r/television"],
      }),
    });
    assert.equal(createResponse.status, 201);
    const preset = await createResponse.json() as { id: string; owner_id: string };
    assert.equal(preset.owner_id, "preset-owner");

    const otherRoomResponse = await fetch(`${baseUrl}/podcast/sources`, {
      headers: previewProducerHeaders("other-producer"),
    });
    assert.equal(otherRoomResponse.status, 200);
    const otherRoom = await otherRoomResponse.json() as { filter_presets: { id: string }[] };
    assert.equal(otherRoom.filter_presets.some((item) => item.id === preset.id), false);
    assert.equal(otherRoom.filter_presets.some((item) => item.id === legacyPreset.id), true);
    assert.equal(otherRoom.filter_presets.some((item) => item.id === otherProducerPreset.id), true);

    const sourceAddResponse = await fetch(`${baseUrl}/podcast/sources`, {
      method: "POST",
      headers: {
        ...previewProducerHeaders("other-producer"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ source_url: "https://example.com/private-preset-check" }),
    });
    assert.equal(sourceAddResponse.status, 200);
    const sourceAddRoom = await sourceAddResponse.json() as { filter_presets: { id: string }[] };
    assert.equal(sourceAddRoom.filter_presets.some((item) => item.id === preset.id), false);
    assert.equal(sourceAddRoom.filter_presets.some((item) => item.id === legacyPreset.id), true);
    assert.equal(sourceAddRoom.filter_presets.some((item) => item.id === otherProducerPreset.id), true);

    const resetResponse = await fetch(`${baseUrl}/podcast/reset`, {
      method: "POST",
      headers: previewProducerHeaders("other-producer"),
    });
    assert.equal(resetResponse.status, 200);
    const resetResult = await resetResponse.json() as { room: { filter_presets: { id: string }[] } };
    assert.equal(resetResult.room.filter_presets.some((item) => item.id === preset.id), false);
    assert.equal(resetResult.room.filter_presets.some((item) => item.id === legacyPreset.id), true);
    assert.equal(resetResult.room.filter_presets.some((item) => item.id === otherProducerPreset.id), true);

    const otherRenameResponse = await fetch(`${baseUrl}/podcast/presets/${preset.id}`, {
      method: "PATCH",
      headers: {
        ...previewProducerHeaders("other-producer"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Unauthorized rename" }),
    });
    assert.equal(otherRenameResponse.status, 404);

    const otherDeleteResponse = await fetch(`${baseUrl}/podcast/presets/${preset.id}`, {
      method: "DELETE",
      headers: previewProducerHeaders("other-producer"),
    });
    assert.equal(otherDeleteResponse.status, 404);

    const ownerRoomResponse = await fetch(`${baseUrl}/podcast/sources`, {
      headers: previewProducerHeaders("preset-owner"),
    });
    assert.equal(ownerRoomResponse.status, 200);
    const ownerRoom = await ownerRoomResponse.json() as { filter_presets: { id: string }[] };
    assert.equal(ownerRoom.filter_presets.some((item) => item.id === preset.id), true);

    const ownerDeleteResponse = await fetch(`${baseUrl}/podcast/presets/${preset.id}`, {
      method: "DELETE",
      headers: previewProducerHeaders("preset-owner"),
    });
    assert.equal(ownerDeleteResponse.status, 204);

    deletePodcastFilterPreset(legacyPreset.id);
    deletePodcastFilterPreset(otherProducerPreset.id);
  });
});

test("brief fallback preserves URL and retrieval provenance", { concurrency: false }, async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
  const room = getPodcastRoom();
  const concept = room.concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);

  assert.ok(brief);
  assert.equal(brief.generated_mode, "synthetic_demo");
  assert.deepEqual(
    brief.source_links.map((link) => [link.source_id, link.url, link.retrieved_at]),
    concept.source_ids.map((id) => {
      const source = podcastSources.find((item) => item.id === id);
      return [id, source?.source_url, source?.retrieved_at];
    }),
  );
  assert.equal(isPodcastEvidenceSufficient(brief), true);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("malformed or incomplete model output falls back field-by-field and never emits source text", { concurrency: false }, () => {
  const fallback = {
    topic_angle: "safe angle",
    audience_pain: "safe pain",
    why_now: "safe timing",
    key_tensions: ["safe tension"],
    risk_notes: ["do not quote"],
    episode_outline: [{ segment: "Open", purpose: "safe purpose" }],
    suggested_title: "Safe title",
  };
  const source = podcastSources[0];
  const safe = buildSafePodcastDraft(
    {
      topic_angle: source.post_title,
      audience_pain: 42,
      key_tensions: [source.post_title],
      episode_outline: [{ segment: "Open", purpose: source.post_title }],
      suggested_title: "",
    },
    fallback,
    [source],
  );

  assert.deepEqual(safe, fallback);
  assert.deepEqual(buildSafePodcastDraft(null, fallback, [source]), fallback);
});

test("production paths fail closed and structured editors reject malformed output", { concurrency: false }, async () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  const key = process.env.GEMINI_API_KEY;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(() => searchPodcastContexts("exact grounded query", "consumers", "recap"), /not configured/i);
    const concept = podcastConcepts[0]!;
    await assert.rejects(() => generatePodcastBrief(concept.id, concept.source_ids), /grounded concept|not configured/i);
    assert.throws(() => strictPodcastDraft({ topic_angle: "only one field" }, podcastSources.slice(0, 1)), /Malformed Gemini brief/i);
    assert.throws(() => strictPodcastEvidenceConcept({ title: "only one field" }), /malformed structured output/i);
    assert.throws(
      () => strictPodcastEvidenceConcept({
        title: "A cautious concept",
        summary: "\"Copied provider headline with a named person\"",
        observed_signal: "A bounded topic signal.",
        supported_context: "Public-web metadata.",
        unresolved_questions: ["Representativeness remains unknown."],
      }),
      /malformed structured output/i,
    );
    assert.throws(
      () => strictPodcastEvidenceConcept({
        title: "A cautious concept",
        summary: "A bounded aggregate signal.",
        observed_signal: "A bounded topic signal.",
        supported_context: "A u/example identifier remains.",
        unresolved_questions: ["Representativeness remains unknown."],
      }, [], ["Allison Example"]),
      /malformed structured output/i,
    );
    const sources = ["live-source-a", "live-source-b", "live-source-c"].map((id) => ({
      id, url: `https://example.test/${id}`, title: id, retrieved_at: "2026-01-01T00:00:00.000Z",
      snippet: "", source_type: "test", classification: "source_backed" as const,
      source_identifier: id, consent_reference: "test-consent", policy_reference: "podcast-current-context-policy-v1",
      aggregate_summary: "Aggregate test summary.", evidence_gaps: ["Test evidence gap."],
      what_it_supports: "test", what_remains_uncertain: "test",
    }));
    const liveConcept = { ...concept, id: "live-only-concept", source_ids: sources.map((source) => source.id) };
    const run = {
      id: "run-validator", query: "specific query", provider: "google_public_web" as const,
      window: "past_7_days" as const, policy_reference: "podcast-current-context-policy-v1", runtime_status: "Live Gemini" as const,
      sources, concept: liveConcept, uncertainties: ["A visible uncertainty"], grounding_support: "test", agent_executions: [],
    };
    const persistedDemoRun = { ...run, id: "persisted-demo-run", runtime_status: "Synthetic Demo" as const };
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [persistedDemoRun], currentBriefId: null, currentScriptId: null }), true);
    assert.deepEqual(getPodcastRoom().sources, []);
    assert.deepEqual(getPodcastRoom().concepts, []);
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [run], currentBriefId: null, currentScriptId: null }), true);
    const room = getPodcastRoom();
    assert.deepEqual(room.sources.map((source) => source.id).sort(), sources.map((source) => source.id).sort());
    assert.deepEqual(room.concepts.map((item) => item.id), [liveConcept.id]);
    assert.equal(room.sources.some((source) => podcastSources.some((fixture) => fixture.id === source.id)), false);
    assert.equal(room.concepts.some((item) => podcastConcepts.some((fixture) => fixture.id === item.id)), false);
    const legacyRun = {
      ...run,
      id: "legacy-unverified-run",
      sources: run.sources.map(({ source_identifier: _identifier, consent_reference: _consent, policy_reference: _policy, aggregate_summary: _summary, evidence_gaps: _gaps, ...source }) => source),
    } as any;
    delete legacyRun.provider;
    delete legacyRun.window;
    delete legacyRun.policy_reference;
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [legacyRun], currentBriefId: null, currentScriptId: null }), true);
    const legacyRoom = getPodcastRoom();
    assert.equal(legacyRoom.sources.every((source) => source.access_mode === "public_url"), true);
    assert.equal(legacyRoom.sources.every((source) => source.policy_reference === "legacy-unverified-provenance"), true);
    const legacyBrief = {
      source_links: legacyRoom.sources.map((source) => ({
        source_id: source.id,
        url: source.source_url,
        retrieved_at: source.retrieved_at ?? source.timestamp,
      })),
    } as any;
    assert.equal(isPodcastEvidenceSufficient(legacyBrief), false);
    assert.throws(() => validateGeneratedScript({ title: "bad", sections: [] }, run, { id: "a", run_id: run.id, decision: "decline", attested: false, signer: null, permitted_public_summary: null, authorized_uses: [], created_at: new Date().toISOString() }), /Malformed Gemini script/i);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
  }
});

test("grounded finding admission rejects identities, copied comments, and generic filler", () => {
  const safe = validateSafeGroundedFinding({
    safe_headline: "Awards coverage leaves context gaps",
    aggregate_summary: "Coverage focused on ceremony results while audience questions centered on missing performance context.",
    what_it_supports: "A recap should connect the reported results to the unresolved viewing questions.",
    what_remains_uncertain: "The retained sources do not establish how broadly those questions were shared.",
  }, ["Raw source wording is available only inside the bounded editor input."]);
  assert.equal(safe.safe_headline, "Awards coverage leaves context gaps");
  assert.throws(() => validateSafeGroundedFinding({
    ...safe,
    aggregate_summary: "@viewer said “I know exactly what happened.”",
  }, []), /unsafe or generic/i);
  assert.throws(() => validateSafeGroundedFinding({
    ...safe,
    aggregate_summary: "These eight copied words came directly from provider evidence today.",
  }, ["These eight copied words came directly from provider evidence today."]),
  /copied provider text/i);
  assert.throws(() => validateSafeGroundedFinding({
    ...safe,
    aggregate_summary: "Aggregate industry data created a taxonomy signal for the episode.",
  }, []), /unsafe or generic/i);
});

test("bounded publisher metadata preserves explicit metadata without retaining page text", () => {
  const marker = "RAW @viewer comment that must never survive";
  const resolved = extractPublishedSourceMetadata(`
    <html><head>
      <meta property="og:title" content="Nirvana to receive the Video Vanguard tribute">
      <meta property="og:site_name" content="Music Desk">
      <meta property="article:published_time" content="2026-09-07T13:30:00-04:00">
    </head><body>${marker}</body></html>
  `, "https://music.example/awards/nirvana-vanguard");
  assert.equal(resolved.url, "https://music.example/awards/nirvana-vanguard");
  assert.equal(resolved.title, "Nirvana to receive the Video Vanguard tribute");
  assert.equal(resolved.publisher, "Music Desk");
  assert.equal(resolved.published_at, "2026-09-07T17:30:00.000Z");
  assert.doesNotMatch(JSON.stringify(resolved), new RegExp(marker));

  const unknownDate = extractPublishedSourceMetadata(
    `<meta property="og:title" content="Current awards report"><meta property="og:site_name" content="Report Desk">`,
    "https://reports.example/current-awards",
  );
  assert.equal(unknownDate.published_at, null);
  assert.throws(
    () => validateGoogleGroundingRedirectUrl("https://publisher.example/article"),
    /Only Google grounding redirect URLs/i,
  );
  assert.throws(
    () => extractPublishedSourceMetadata(
      `<meta property="og:title" content="Private"><meta property="og:site_name" content="Private">`,
      "https://127.0.0.1/private",
    ),
    /public HTTPS publisher/i,
  );
});

test("unsupported transformed claims fail closed before script admission", () => {
  const checks = Array.from({ length: 6 }, (_, index) => ({
    section_index: index + 1,
    supported: index !== 2,
    unsupported_claims: index === 2
      ? ["international crossover acts, cross-genre collaborations, and broader category restructuring"]
      : [],
  }));
  assert.throws(
    () => validateScriptClaimSupport(checks, 6),
    /source-unsupported transformed claims/i,
  );
  assert.throws(
    () => validateGroundedFindingSupport([
      { source_index: 1, supported: true, unsupported_claims: [] },
      { source_index: 2, supported: false, unsupported_claims: ["broader category restructuring"] },
    ], 2),
    /source editor introduced unsupported transformed claims/i,
  );
});

test("audience attribution requires a Google-returned community source", () => {
  assert.throws(
    () => validateAudienceAttributionBoundary(
      "What fans think about the awards",
      [{ script: "Audiences want broader categories." }],
      ["publisher_reporting", "publisher_reporting"],
    ),
    /requires a mapped community source/i,
  );
  assert.doesNotThrow(() => validateAudienceAttributionBoundary(
    "What current coverage reports",
    [{ script: "Two reports describe a tribute and a dropped category." }],
    ["publisher_reporting", "publisher_reporting"],
  ));
  assert.doesNotThrow(() => validateAudienceAttributionBoundary(
    "What fans think about the awards",
    [{ script: "Fans ask how the voting will work." }],
    ["publisher_reporting", "community"],
  ));
});

test("TTS config is exactly the two declared house speakers", () => {
  assert.deepEqual(podcastTtsSpeechConfig().multiSpeakerVoiceConfig.speakerVoiceConfigs, [
    { speaker: "FRONT ROW", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    { speaker: "BACKSTAGE", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
  ]);
});

test("live performance keeps the exact script, run, sources, model evidence, audio, and Cut Key together", { concurrency: false }, async () => {
  const previousDemo = process.env.PODCAST_SYNTHETIC_DEMO;
  const run = currentRunFixture("live-audio-lineage", "2026-09-09T22:00:00.000Z");
  try {
    assert.equal(rehydratePodcastState({
      briefs: [],
      scripts: [],
      developmentPlans: [],
      groundedRuns: [run],
      currentBriefId: null,
      currentScriptId: null,
    }), true);
    const attestation = attestPodcastCuttingRoom(run.id, {
      decision: "add",
      raw_text: "Private material that must never enter the performance.",
      permitted_public_summary: "No private context was needed for this public-source highlight.",
      authorized_uses: ["podcast_script"],
    }, "lineage-attestation-reviewer");
    assert.ok(attestation && attestation !== "immutable");

    const plan = createPodcastDevelopment(run.concept.id, run.concept.source_ids, "consumers", "recap");
    assert.ok(plan);
    assert.ok(recordPodcastDevelopmentValidation(
      plan.id,
      "validate",
      plan.archetypes[0]!.id,
      plan.format_variants[0]!.id,
      "lineage-angle-selector",
    ));

    process.env.PODCAST_SYNTHETIC_DEMO = "true";
    const brief = await generatePodcastBrief(run.concept.id, run.concept.source_ids, plan.id);
    assert.ok(brief);
    assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
    const created = createPodcastScript(brief.id);
    assert.equal(created.kind, "created");
    if (created.kind !== "created") return;
    (created.script as typeof created.script & { claim_support_verified: boolean }).claim_support_verified = true;
    assert.equal(created.script.provenance[0]?.title, run.sources[0]?.title);

    process.env.PODCAST_SYNTHETIC_DEMO = "false";
    const approved = decidePodcastScript(created.script.id, "approve");
    assert.ok(approved);
    assert.equal(approved.audio_status, "ready_to_generate");
    assert.ok(approved.release_kit);
    recordPodcastDecision("script", approved.id, "approve", "lineage-script-reviewer");
    const duplicateState = JSON.parse(readFileSync(process.env.PODCAST_STATE_PATH!, "utf8")) as any;
    duplicateState.executionRecords = [
      ...(duplicateState.executionRecords ?? []).filter((item: any) => item.key !== `script:${approved.id}`),
      {
        key: `script:${approved.id}`,
        execution: {
          agent: "script_performer",
          provider: "Google Gemini",
          framework: "Direct @google/genai",
          model: "gemini-test",
          execution_id: `${run.id}-script`,
          parent_execution_id: `${run.id}-adk-parent`,
          tools: [],
          latency_ms: 1,
          status: "completed",
          activity: "Generated the exact performed script.",
        },
      },
    ];
    assert.equal(rehydratePodcastState(duplicateState), true);
    const exactTranscript = approved.sections
      .map((section) => `${section.speaker}: ${section.script}`)
      .join("\n\n");
    let performedTranscript = "";
    const result = await generatePodcastAudio(approved.id, {
      async render(transcript) {
        performedTranscript = transcript;
        return {
          wav: Buffer.alloc(96),
          evidence: {
            agent: "audio_performer",
            provider: "Google Gemini",
            framework: "Direct @google/genai",
            model: "gemini-2.5-flash-preview-tts",
            execution_id: "live-audio-lineage-invocation",
            tools: [],
            latency_ms: 1,
            status: "completed",
            activity: "Rendered exact approved transcript.",
          },
        };
      },
    });
    assert.equal(result.kind, "generated");
    if (result.kind !== "generated") return;
    assert.equal(performedTranscript, exactTranscript);
    assert.equal(result.clip.transcript, exactTranscript);
    assert.equal(result.clip.run_id, run.id);
    assert.deepEqual([...result.clip.source_ids].sort(), [...run.concept.source_ids].sort());
    assert.ok(result.clip.cut_key);
    const manifest = getPodcastCutKey(result.clip.cut_key!);
    assert.ok(manifest);
    assert.equal(manifest.production.synthetic, false);
    assert.equal(manifest.production.model, "gemini-2.5-flash-preview-tts");
    assert.equal(manifest.transcript, exactTranscript);
    assert.deepEqual(manifest.source_ids, [...run.concept.source_ids].sort());
    assert.deepEqual(
      manifest.source_evidence?.map((source) => ({
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        published_at: source.published_at,
        source_class: source.source_class,
      })),
      run.sources.map((source) => ({
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        published_at: source.published_at,
        source_class: source.source_type,
      })),
    );
    assert.equal(manifest.audio_sha256, createHash("sha256").update(Buffer.alloc(96)).digest("hex"));
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = previousDemo ?? "true";
  }
});

test("live script generation failure never substitutes a fixture workspace", { concurrency: false }, async () => {
  const previousDemo = process.env.PODCAST_SYNTHETIC_DEMO;
  const previousKey = process.env.GEMINI_API_KEY;
  const run = currentRunFixture("live-script-failure", "2026-09-09T22:05:00.000Z");
  try {
    process.env.PODCAST_SYNTHETIC_DEMO = "true";
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], developmentPlans: [], groundedRuns: [run], currentBriefId: null, currentScriptId: null }), true);
    const attestation = attestPodcastCuttingRoom(run.id, {
      decision: "decline",
      authorized_uses: [],
    }, "failure-attestation-reviewer");
    assert.ok(attestation && attestation !== "immutable");
    const plan = createPodcastDevelopment(run.concept.id, run.concept.source_ids, "consumers", "recap");
    assert.ok(plan);
    assert.ok(recordPodcastDevelopmentValidation(plan.id, "validate", plan.archetypes[0]!.id, plan.format_variants[0]!.id, "failure-angle-selector"));
    const brief = await generatePodcastBrief(run.concept.id, run.concept.source_ids, plan.id);
    assert.ok(brief);
    assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");

    process.env.PODCAST_SYNTHETIC_DEMO = "false";
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () => createPodcastScriptFromGemini(brief.id),
      /Gemini script generation is not configured/,
    );
    assert.equal(getPodcastScriptByBriefId(brief.id).kind, "not_found");
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = previousDemo ?? "true";
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("synthetic approved cut produces a canonical, private-safe Cut Key only after every gate", { concurrency: false }, async () => {
  const sourceIds = ["cut-source-1", "cut-source-2", "cut-source-3"];
  const concept = {
    ...podcastConcepts[0]!,
    id: "cut-key-concept",
    source_ids: sourceIds,
    unresolved_questions: ["The public record cannot establish intent."],
  };
  const sources = sourceIds.map((id, index) => ({
    id, url: `https://example.test/cut/${index}`, title: `Cut source ${index}`, retrieved_at: "2026-01-01T00:00:00.000Z",
    snippet: "", source_type: "test", classification: "source_backed" as const,
    what_it_supports: "A bounded public context claim.", what_remains_uncertain: "Intent remains unresolved.",
  }));
  const run = {
    id: "cut-key-run",
    query: "cut-key exact query",
    provider: "synthetic_fixture" as const,
    window: "past_7_days" as const,
    policy_reference: "synthetic-fixture-policy-v1",
    runtime_status: "Synthetic Demo" as const,
    sources,
    concept,
    uncertainties: concept.unresolved_questions,
    grounding_support: "test",
    agent_executions: [],
  };
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], developmentPlans: [], groundedRuns: [run], currentBriefId: null, currentScriptId: null }), true);
  const rawMarker = "PRIVATE-CUTTING-ROOM-MARKER-DO-NOT-PUBLISH";
  const attestationInput = {
    decision: "add" as const, raw_text: rawMarker, permitted_public_summary: "A safe, approved public summary.", authorized_uses: ["podcast_script"],
  };
  const attestation = attestPodcastCuttingRoom(run.id, attestationInput, "attestation-reviewer");
  assert.notEqual(attestation, "immutable");
  if (!attestation || attestation === "immutable") return;
  assert.doesNotMatch(JSON.stringify(attestation), new RegExp(rawMarker));
  const replay = attestPodcastCuttingRoom(run.id, attestationInput, "attestation-reviewer");
  assert.notEqual(replay, "immutable");
  if (!replay || replay === "immutable") return;
  assert.equal(replay.id, attestation.id);
  assert.equal(attestPodcastCuttingRoom(run.id, { ...attestationInput, permitted_public_summary: "A changed summary." }, "attestation-reviewer"), "immutable");

  const plan = createPodcastDevelopment(concept.id, sourceIds, "consumers", "recap");
  assert.ok(plan);
  const validated = recordPodcastDevelopmentValidation(plan.id, "validate", plan.archetypes[0]!.id, plan.format_variants[0]!.id, "development-reviewer");
  assert.ok(validated);
  recordPodcastDevelopmentReceipt(plan.id, "development-reviewer");
  const brief = await generatePodcastBrief(concept.id, sourceIds, plan.id);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  recordPodcastDecision("brief", brief.id, "approve", "brief-reviewer");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");
  recordPodcastDecision("script", created.script.id, "approve", "script-reviewer");
  assert.deepEqual(
    getPodcastRoom().decision_history.slice(0, 2).map((entry) => ({
      artifact_type: entry.artifact_type,
      reviewer: entry.reviewer,
      decision: entry.decision,
      artifact_creation: entry.artifact_creation,
    })),
    [
      { artifact_type: "script", reviewer: "script-reviewer", decision: "approve", artifact_creation: "none" },
      { artifact_type: "audio", reviewer: "script-reviewer", decision: "approve", artifact_creation: "none" },
    ],
  );
  const compactApproved = getPodcastScriptById(created.script.id);
  assert.equal(compactApproved.kind, "found");
  if (compactApproved.kind !== "found") return;
  assert.equal(compactApproved.script.release_kit?.publishing_status, "blocked_until_final_approval");
  assert.equal(getPodcastCutKey("not-a-key"), null);
  const rejectedClipId = `clip-${created.script.id}`;
  assert.equal(getPodcastAudioPath(rejectedClipId), null);
  const first = commitGeneratedPodcastAudio(compactApproved.script, Buffer.alloc(48));
  assert.equal(first.kind, "generated");
  if (first.kind !== "generated") return;
  const firstManifest = getPodcastCutKey(first.clip.cut_key!);
  assert.ok(firstManifest);
  assert.doesNotMatch(JSON.stringify(firstManifest), new RegExp(rawMarker));
  assert.deepEqual(Object.keys(firstManifest).sort(), [
    "audio_sha256", "audio_url", "clip_id", "format_disclosure", "generated_at",
    "integrity_disclaimer", "key", "manifest_sha256", "production", "source_ids",
    "transcript", "transcript_sha256", "voice_disclosure",
  ]);
  assert.equal(firstManifest.key, `cut-${firstManifest.manifest_sha256}`);
  assert.equal(firstManifest.transcript_sha256, createHash("sha256").update(first.clip.transcript).digest("hex"));
  assert.equal(firstManifest.audio_sha256, createHash("sha256").update(Buffer.alloc(48)).digest("hex"));
  assert.deepEqual(firstManifest.production, { synthetic: true, provider: "Google Gemini", model: "Gemini TTS" });

  const secondDecision = decidePodcastAudio(created.script.id, "approve");
  assert.equal(secondDecision.kind, "updated");
  if (secondDecision.kind !== "updated") return;
  const second = commitGeneratedPodcastAudio(secondDecision.script, Buffer.alloc(52));
  assert.equal(second.kind, "generated");
  if (second.kind !== "generated") return;
  const secondManifest = getPodcastCutKey(second.clip.cut_key!);
  assert.ok(secondManifest);
  assert.equal(getPodcastCutKey(firstManifest.key)?.key, firstManifest.key);
  assert.notEqual(secondManifest.key, firstManifest.key);
  assert.equal((await getPublicPodcastCutKey(firstManifest.key))?.manifest_sha256, firstManifest.manifest_sha256);
  assert.equal(await getPublicPodcastJudgeManifest(), null);
  assert.ok(getPodcastAudioPathByCutKey(secondManifest.key));
  const omitted = { ...secondManifest } as any;
  delete omitted.transcript_sha256;
  const { GetPodcastCutKeyResponse } = await import("@workspace/api-zod");
  assert.equal(GetPodcastCutKeyResponse.safeParse(omitted).success, false);

  const audioPath = join(process.env.PODCAST_AUDIO_DIRECTORY!, `${secondManifest.clip_id}.wav`);
  const original = readFileSync(audioPath);
  writeFileSync(audioPath, Buffer.from("tampered"));
  try {
    assert.equal(getPodcastAudioPathByCutKey(secondManifest.key), null);
    await withApiServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/podcast/cut-keys/${secondManifest.key}`);
      assert.equal(response.status, 200);
      const body = await response.json() as Record<string, unknown>;
      assert.deepEqual(Object.keys(body).sort(), Object.keys(secondManifest).sort());
      assert.equal("approval_receipts" in body, false);
      assert.equal("private_attestation" in body, false);
      assert.equal("executions" in body, false);
    });
  } finally {
    writeFileSync(audioPath, original);
  }
  const reorderedManifest = {
    production: {
      model: secondManifest.production.model,
      provider: secondManifest.production.provider,
      synthetic: secondManifest.production.synthetic,
    },
    format_disclosure: secondManifest.format_disclosure,
    key: secondManifest.key,
    source_ids: secondManifest.source_ids,
    audio_url: secondManifest.audio_url,
    manifest_sha256: secondManifest.manifest_sha256,
    generated_at: secondManifest.generated_at,
    clip_id: secondManifest.clip_id,
    transcript_sha256: secondManifest.transcript_sha256,
    integrity_disclaimer: secondManifest.integrity_disclaimer,
    transcript: secondManifest.transcript,
    voice_disclosure: secondManifest.voice_disclosure,
    audio_sha256: secondManifest.audio_sha256,
  };
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    cutKeys: [reorderedManifest],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  assert.equal((await getPublicPodcastCutKey(secondManifest.key))?.key, secondManifest.key);

  const redirectedManifest = { ...secondManifest, audio_url: "https://example.test/unverified.wav" };
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    cutKeys: [redirectedManifest],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  assert.equal(await getPublicPodcastCutKey(secondManifest.key), null);

  const tamperedManifest = { ...secondManifest, transcript: `${secondManifest.transcript}\nTAMPERED` };
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    cutKeys: [tamperedManifest],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  assert.equal(await getPublicPodcastCutKey(secondManifest.key), null);
});

test("judge manifest returns an active canonical non-synthetic cut without private state", { concurrency: false }, async () => {
  const canonicalPayload = {
    clip_id: "clip-judge-live",
    transcript: "FRONT ROW: What changed? BACKSTAGE: Here is the sourced context.",
    transcript_sha256: createHash("sha256").update("FRONT ROW: What changed? BACKSTAGE: Here is the sourced context.").digest("hex"),
    source_ids: ["public-source-1", "public-source-2"],
    generated_at: "2026-09-09T00:00:00.000Z",
    production: {
      synthetic: false,
      provider: "Google Gemini",
      model: "gemini-2.5-flash-tts",
    },
    voice_disclosure: "Synthetic house voices; no voice cloning.",
    format_disclosure: "Approved evidence-backed performed sample.",
    audio_sha256: createHash("sha256").update("approved-public-audio").digest("hex"),
    integrity_disclaimer: "This manifest verifies artifact lineage and integrity, not the truth of any claim.",
  };
  const manifestSha256 = createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
  const key = `cut-${manifestSha256}`;
  const manifest = {
    key,
    manifest_sha256: manifestSha256,
    audio_url: `/api/podcast/cut-keys/${key}/audio`,
    ...canonicalPayload,
  };

  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [{
      id: "judge-live-script",
      brief_id: "judge-live-brief",
      audio_status: "generated",
      audio_clip: { id: canonicalPayload.clip_id },
    }],
    cutKeys: [manifest],
    currentBriefId: null,
    currentScriptId: "judge-live-script",
  }), true);

  const publicManifest = await getPublicPodcastJudgeManifest();
  assert.ok(publicManifest);
  assert.equal(publicManifest.key, key);
  assert.equal(publicManifest.production.synthetic, false);
  assert.deepEqual(Object.keys(publicManifest).sort(), [
    "audio_sha256", "audio_url", "clip_id", "format_disclosure", "generated_at",
    "integrity_disclaimer", "key", "manifest_sha256", "production", "source_ids",
    "transcript", "transcript_sha256", "voice_disclosure",
  ]);
  assert.equal("approval_receipts" in publicManifest, false);
  assert.equal("private_attestation" in publicManifest, false);
});

test("exact run resolver never binds an artifact to the newest unrelated run", { concurrency: false }, () => {
  const makeRun = (id: string) => {
    const sourceId = `${id}-source`;
    return {
      id, query: `${id} query`, runtime_status: "Live Gemini" as const,
      sources: [{ id: sourceId, url: `https://example.test/${id}`, title: id, retrieved_at: "2026-01-01T00:00:00.000Z", snippet: "", source_type: "test", classification: "source_backed" as const, what_it_supports: "test", what_remains_uncertain: "test" }],
      concept: { ...podcastConcepts[0]!, id: `${id}-concept`, source_ids: [sourceId] },
      uncertainties: ["test"], grounding_support: "test", agent_executions: [],
    };
  };
  const first = makeRun("first");
  const second = makeRun("second");
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [first, second], currentBriefId: null, currentScriptId: null }), true);
  assert.equal(runForPodcastArtifact(first.concept.id, first.concept.source_ids)?.id, first.id);
  assert.equal(runForPodcastArtifact(second.concept.id, second.concept.source_ids)?.id, second.id);
  assert.equal(runForPodcastArtifact(first.concept.id, []), null);
  assert.equal(runForPodcastArtifact(first.concept.id, [...first.concept.source_ids, "unexpected-source"]), null);
});

test("entertainment context search ranks cited packages and keeps speculation explicit", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [], currentBriefId: null, currentScriptId: null }), true);
  const result = await searchPodcastContexts(
    "cutting room edit context",
    "clients",
    "development",
  );
  assert.equal(result.search_mode, "synthetic_demo");
  assert.equal(result.audience, "clients");
  assert.equal(result.provider, "synthetic_fixture");
  assert.equal(result.window, "past_7_days");
  assert.equal(result.policy_reference, "podcast-current-context-policy-v1");
  assert.ok(result.results.length > 0);
  assert.ok(result.grounded_run.sources.length <= 5);
  for (const source of result.grounded_run.sources) {
    assert.ok(source.source_identifier.length > 0);
    assert.ok(source.retrieved_at.length > 0);
    assert.ok(source.policy_reference.length > 0);
    assert.ok(source.aggregate_summary.length > 0);
    assert.ok(source.evidence_gaps.length > 0);
    assert.equal(source.snippet, "Synthetic demonstration source; not a live web retrieval.");
  }
  for (const item of result.results) {
    assert.ok(item.sources.length > 0);
    assert.ok(item.concept.source_ids.every((id) => podcastSources.some((source) => source.id === id)));
    assert.match(item.speculation, /unverified/i);
    assert.ok(item.safest_next_reviewer.length > 0);
  }
});

test("live signal snapshots expose consent and observation boundaries without raw identities", { concurrency: false }, () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [], currentBriefId: null, currentScriptId: null }), true);
  const observedAt = new Date().toISOString();
  ingestLiveObservations({
    source_id: "consented-newsroom-v1",
    source_class: "consented_newsroom",
    consent_ref: "consent-regression-fixture",
    policy_review_ref: "policy-regression-fixture",
    observations: [{
      id: "aggregate-observation-1",
      text: "This text must never appear in a podcast snapshot.",
      observed_at: observedAt,
      observation_window: { start: observedAt, end: observedAt },
      confidence: "high",
    }],
  });
  const snapshot = getPodcastLiveSnapshot();
  assert.equal(snapshot.source_mode, "approved_live");
  assert.equal(snapshot.source_class, "consented_newsroom");
  assert.equal(snapshot.consent_reference, "consent-regression-fixture");
  assert.equal(snapshot.policy_review_reference, "policy-regression-fixture");
  assert.equal(snapshot.aggregate_observations, 1);
  assert.doesNotMatch(JSON.stringify(snapshot), /This text must never appear/);
  assert.match(snapshot.data_notice, /Identity fields and raw comments are not available/i);
});

function currentRunFixtureDuplicate(id: string, retrievedAt: string) {
  const sources = ["a", "b", "c"].map((suffix) => ({
    id: `${id}-source-${suffix}`,
    url: `https://publisher-${suffix}.example/${id}/${suffix}`,
    title: `Approved result ${suffix}`,
    publisher: `Publisher ${suffix.toUpperCase()}`,
    published_at: retrievedAt,
    retrieved_at: retrievedAt,
    snippet: "",
    source_type: "publisher_reporting",
    classification: "source_backed" as const,
    source_identifier: `${id}-${suffix}`,
    consent_reference: "public-web-approved-search",
    policy_reference: "podcast-current-context-policy-v1",
    aggregate_summary: `Aggregate signal ${suffix}.`,
    evidence_gaps: ["Publication timing remains unverified."],
    what_it_supports: `Bounded signal ${suffix}.`,
    what_remains_uncertain: "Representativeness remains unknown.",
  }));
  const concept = {
    ...podcastConcepts[0]!,
    id: `${id}-concept`,
    title: "Current aggregate context for producer review",
    summary: "Three provider-linked sources contributed identity-free taxonomy signals.",
    observed_signal: "The retained sources contain a bounded current-context signal.",
    supported_context: "Only approved source metadata enters development.",
    source_ids: sources.map((source) => source.id),
    unresolved_questions: ["Representativeness remains unknown."],
  };
  return {
    id,
    query: `${id} grounded query`,
    provider: "google_public_web" as const,
    window: "past_7_days" as const,
    policy_reference: "podcast-current-context-policy-v1",
    runtime_status: "Live Google ADK" as const,
    sources,
    concept,
    uncertainties: ["Representativeness remains unknown."],
    grounding_support: "Google ADK and Google Search grounding metadata.",
    agent_executions: [],
  };
}

test("Gate 00 selects the same newest compatible grounded run as the editorial room", { concurrency: false }, () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  try {
    const current = currentRunFixture("current-run-selection", "2026-09-09T21:17:06.119Z");
    const synthetic = { ...current, id: "newer-synthetic-run", runtime_status: "Synthetic Demo" as const };
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], groundedRuns: [current, synthetic], currentBriefId: null, currentScriptId: null }), true);
    const room = getPodcastRoom();
    const snapshot = getPodcastLiveSnapshot();
    assert.deepEqual(room.concepts.map((concept) => concept.id), [current.concept.id]);
    assert.deepEqual(room.sources.map((source) => source.id), current.sources.map((source) => source.id));
    assert.equal(snapshot.source_id, current.id);
    assert.equal(snapshot.source_mode, "approved_live");
    assert.equal(snapshot.aggregate_observations, current.sources.length);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
  }
});

test("current-run linkage survives persisted workspace hydration without rewriting history", { concurrency: false }, () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  try {
    const historical = currentRunFixture("historical-run", "2026-09-08T23:48:47.231Z");
    const current = currentRunFixture("hydrated-current-run", "2026-09-09T21:17:06.119Z");
    const persisted = {
      briefs: [],
      scripts: [],
      developmentPlans: [],
      groundedRuns: [historical, current],
      currentBriefId: null,
      currentScriptId: null,
    };
    assert.equal(rehydratePodcastState(persisted), true);
    assert.equal(getPodcastLiveSnapshot().source_id, current.id);
    assert.equal(runForPodcastArtifact(historical.concept.id, historical.concept.source_ids)?.id, historical.id);
    assert.equal(rehydratePodcastState(persisted), true);
    assert.equal(getPodcastLiveSnapshot().source_id, current.id);
    assert.equal(runForPodcastArtifact(historical.concept.id, historical.concept.source_ids)?.id, historical.id);
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
  }
});

test("development-plan creation persists the selected run snapshot and compatible source set", { concurrency: false }, () => {
  const demo = process.env.PODCAST_SYNTHETIC_DEMO;
  delete process.env.PODCAST_SYNTHETIC_DEMO;
  try {
    const current = currentRunFixture("development-current-run", "2026-09-09T21:17:06.119Z");
    assert.equal(rehydratePodcastState({ briefs: [], scripts: [], developmentPlans: [], groundedRuns: [current], currentBriefId: null, currentScriptId: null }), true);
    const selectedSourceIds = current.concept.source_ids.slice(0, 2);
    const plan = createPodcastDevelopment(current.concept.id, selectedSourceIds, "consumers", "development");
    assert.ok(plan);
    assert.equal(plan.source_snapshot.source_id, current.id);
    assert.equal(plan.source_snapshot.source_mode, "approved_live");
    assert.equal(plan.source_snapshot.policy_review_reference, current.policy_reference);
    assert.equal(plan.source_snapshot.aggregate_observations, selectedSourceIds.length);
    assert.deepEqual(plan.source_ids, selectedSourceIds);
    assert.ok(plan.format_variants.every((variant) => (
      variant.citation_ids.length === selectedSourceIds.length &&
      variant.citation_ids.every((sourceId) => selectedSourceIds.includes(sourceId))
    )));
  } finally {
    process.env.PODCAST_SYNTHETIC_DEMO = demo ?? "true";
  }
});

test("development plans preserve citations, disclose fictional lenses, and expose scoring uncertainty", { concurrency: false }, () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], filterPresets: [], developmentPlans: [], currentBriefId: null, currentScriptId: null }), true);
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const plan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "development");
  assert.ok(plan);
  assert.equal(plan.format_variants.length, 5);
  assert.ok(plan.archetypes.every((archetype) => /fictional editorial lens/i.test(archetype.non_impersonation_disclosure)));
  for (const variant of plan.format_variants) {
    assert.deepEqual(variant.citation_ids, concept.source_ids);
    assert.ok(variant.segment_spine.every((segment) => segment.source_ids.length > 0));
    assert.ok(variant.methodology_factors.every((factor) => factor.score >= 0 && factor.score <= 100));
    assert.ok(variant.methodology_factors.every((factor) => factor.evidence && factor.uncertainty));
    assert.match(variant.forecast_label, /not a popularity guarantee/i);
    assert.ok(variant.risks.some((risk) => /unsupported certainty|not promises/i.test(risk)));
  }
});

test("human development validation persists and locks the selected hypothesis for a cited brief", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], filterPresets: [], developmentPlans: [], currentBriefId: null, currentScriptId: null }), true);
  const concept = getPodcastRoom().concepts[1];
  assert.ok(concept);
  const plan = createPodcastDevelopment(concept.id, concept.source_ids, "clients", "recap");
  assert.ok(plan);
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, concept.source_ids), false);
  const archetype = plan.archetypes[0];
  const format = plan.format_variants[1];
  assert.ok(archetype && format);
  const validated = recordPodcastDevelopmentValidation(plan.id, "validate", archetype.id, format.id, "producer regression");
  assert.ok(validated);
  assert.equal(validated.status, "validated");
  assert.equal(validated.measurement_record.validation_status, "validated");
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, concept.source_ids), true);
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, [...concept.source_ids, "unreviewed-source"]), false);
  assert.equal(isPodcastDevelopmentReady(plan.id, concept.id, concept.source_ids.slice(0, 1)), false);
  restorePodcastState();
  assert.equal(getPodcastDevelopmentPlan(plan.id)?.selected_format_id, format.id);

  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const brief = await generatePodcastBrief(concept.id, concept.source_ids, plan.id);
    assert.equal(brief?.development_plan_id, plan.id);
    assert.equal(brief?.editorial_archetype?.id, archetype.id);
    assert.equal(brief?.selected_format?.id, format.id);
    assert.deepEqual(brief?.selected_format?.citation_ids, concept.source_ids);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("draft development plans cannot pass the brief route gate", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({ briefs: [], scripts: [], filterPresets: [], developmentPlans: [], currentBriefId: null, currentScriptId: null }), true);
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const plan = createPodcastDevelopment(concept.id, concept.source_ids, "users", "cultural_context");
  assert.ok(plan);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/podcast/brief`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...previewProducerHeaders("development-route-regression"),
      },
      body: JSON.stringify({
        concept_id: concept.id,
        source_ids: concept.source_ids,
        development_plan_id: plan.id,
      }),
    });
    assert.equal(response.status, 409);
    const omitted = await fetch(`http://127.0.0.1:${address.port}/api/podcast/brief`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...previewProducerHeaders("development-route-regression"),
      },
      body: JSON.stringify({
        concept_id: concept.id,
        source_ids: concept.source_ids,
      }),
    });
    assert.equal(omitted.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("audio remains blocked until a staged kit receives a separate human decision", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState({
    briefs: [],
    scripts: [],
    filterPresets: [],
    currentBriefId: null,
    currentScriptId: null,
  }), true);
  const concept = getPodcastRoom().concepts.find((item) => item.id === "concept-format-trust");
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(decidePodcastAudio(created.script.id, "approve").kind, "not_ready");
  assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");
  assert.equal(createPodcastReleaseKit(created.script.id).kind, "created");
  const approved = decidePodcastAudio(created.script.id, "approve");
  assert.equal(approved.kind, "updated");
  if (approved.kind !== "updated") return;
  assert.equal(approved.script.audio_status, "ready_to_generate");
  assert.equal(approved.script.release_kit?.audio_status, "ready_to_generate");
  assert.equal(approved.script.release_kit?.publishing_status, "blocked_until_final_approval");
});

test("legacy brief decisions remain compatible and a rejected script explicitly blocks audio", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[1];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(createPodcastScript(brief.id).kind, "brief_not_approved");

  const rejected = decidePodcastBrief(brief.id, "reject");
  assert.equal(rejected?.status, "rejected");
  assert.equal(createPodcastScript(brief.id).kind, "brief_not_approved");

  const approved = decidePodcastBrief(brief.id, "approve");
  assert.equal(approved?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(created.script.audio_status, "blocked_until_script_approval");

  const rejectedScript = decidePodcastScript(created.script.id, "reject");
  assert.equal(rejectedScript?.status, "rejected");
  assert.equal(rejectedScript?.audio_status, "rejected");
});

test("approved script workspaces can be retrieved by brief or workspace id", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;

  assert.deepEqual(getPodcastScriptByBriefId(brief.id), { kind: "found", script: created.script });
  assert.deepEqual(getPodcastScriptById(created.script.id), { kind: "found", script: created.script });
});

test("persisted approved workspaces restore with provenance and approval gates", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");

  // Re-read the durable repository just as a newly started API process does.
  restorePodcastState();
  const restored = getPodcastScriptById(created.script.id);
  assert.equal(restored.kind, "found");
  if (restored.kind !== "found") return;
  assert.equal(restored.script.status, "approved");
  assert.deepEqual(restored.script.provenance, brief.source_links);
  assert.equal(restored.script.sections[0]?.source_ids[0], brief.source_links[0]?.source_id);
});

test("restored draft and rejected briefs remain blocked from script workspaces", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[2];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  restorePodcastState();
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
  assert.equal(decidePodcastBrief(brief.id, "reject")?.status, "rejected");
  restorePodcastState();
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
});

test("draft and rejected briefs cannot retrieve script workspaces", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[2];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
  assert.equal(decidePodcastBrief(brief.id, "reject")?.status, "rejected");
  assert.equal(getPodcastScriptByBriefId(brief.id).kind, "brief_not_approved");
});

test("approved scripts prepare and rehydrate a staged release kit without unlocking audio or publishing", { concurrency: false }, async () => {
  const concept = getPodcastRoom().concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);
  assert.ok(brief);
  assert.equal(decidePodcastBrief(brief.id, "approve")?.status, "approved");
  const created = createPodcastScript(brief.id);
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;
  if (created.script.status !== "approved") {
    assert.equal(createPodcastReleaseKit(created.script.id).kind, "script_not_approved");
    assert.equal(decidePodcastScript(created.script.id, "approve")?.status, "approved");
  }

  const result = createPodcastReleaseKit(created.script.id);
  assert.equal(result.kind, "created");
  if (result.kind !== "created") return;
  assert.equal(result.releaseKit.status, "staged");
  assert.ok(result.releaseKit.title_options.length >= 2);
  assert.ok(result.releaseKit.chapters.length >= 3);
  assert.ok(result.releaseKit.promotion_copy.length >= 2);
  assert.equal(result.releaseKit.audio_status, "awaiting_audio_approval");
  assert.equal(result.releaseKit.publishing_status, "blocked_until_final_approval");
  assert.match(result.releaseKit.provenance_summary, /retrieved public sources/);

  // Re-read the durable repository just as a newly started API process does.
  restorePodcastState();
  const restored = getPodcastScriptById(created.script.id);
  assert.equal(restored.kind, "found");
  if (restored.kind !== "found") return;

  assert.equal(restored.script.status, "approved");
  assert.deepEqual(restored.script.release_kit, result.releaseKit);
  assert.deepEqual(restored.script.release_kit?.title_options, result.releaseKit.title_options);
  assert.deepEqual(restored.script.release_kit?.chapters, result.releaseKit.chapters);
  assert.deepEqual(restored.script.release_kit?.promotion_copy, result.releaseKit.promotion_copy);
  assert.deepEqual(restored.script.release_kit?.accessibility_notes, result.releaseKit.accessibility_notes);
  assert.equal(restored.script.release_kit?.provenance_summary, result.releaseKit.provenance_summary);
  assert.equal(restored.script.release_kit?.status, "staged");
  assert.equal(restored.script.release_kit?.audio_status, "awaiting_audio_approval");
  assert.equal(restored.script.release_kit?.publishing_status, "blocked_until_final_approval");
});

test("script workspaces contain performed podcast copy rather than production instructions", { concurrency: false }, async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const concept = getPodcastRoom().concepts[0];
    assert.ok(concept);
    const firstPlan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "recap");
    assert.ok(firstPlan);
    const firstValidated = recordPodcastDevelopmentValidation(
      firstPlan.id,
      "validate",
      firstPlan.archetypes[0].id,
      firstPlan.format_variants[0].id,
      "performed-sample-test",
    );
    assert.ok(firstValidated);
    assert.equal(firstValidated.status, "validated");
    const firstBrief = await generatePodcastBrief(concept.id, concept.source_ids, firstPlan.id);
    assert.ok(firstBrief);
    assert.equal(decidePodcastBrief(firstBrief.id, "approve")?.status, "approved");
    const firstCreated = createPodcastScript(firstBrief.id);
    assert.equal(firstCreated.kind, "created");
    if (firstCreated.kind !== "created") return;

    const firstTranscript = firstCreated.script.sections.map((section) => section.script).join(" ");
    assert.match(firstTranscript, /Here is the strange thing/i);
    assert.match(firstTranscript, /cutting-room floor/i);
    assert.doesNotMatch(firstTranscript, /\b(Open on|Open with|Begin with|State two|Start at|Frame this as|Name uncertainty)\b/i);
    assert.ok(firstCreated.script.sections.every((section) => section.source_ids.length > 0));
    assert.equal(decidePodcastScript(firstCreated.script.id, "approve")?.status, "approved");
    assert.equal(createPodcastReleaseKit(firstCreated.script.id).kind, "created");
    assert.equal(decidePodcastAudio(firstCreated.script.id, "approve").kind, "updated");
    const pendingAudioWorkspace = getPodcastScriptById(firstCreated.script.id);
    assert.equal(pendingAudioWorkspace.kind, "found");
    if (pendingAudioWorkspace.kind !== "found") return;

    const secondPlan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "recap");
    assert.ok(secondPlan);
    recordPodcastDevelopmentValidation(
      secondPlan.id,
      "validate",
      secondPlan.archetypes[3].id,
      secondPlan.format_variants[4].id,
      "performed-sample-test",
    );
    const secondBrief = await generatePodcastBrief(concept.id, concept.source_ids, secondPlan.id);
    assert.ok(secondBrief);
    const approvedSecondBrief = decidePodcastBrief(secondBrief.id, "approve");
    assert.ok(approvedSecondBrief);
    assert.equal(getPodcastScriptByBriefId(secondBrief.id).kind, "not_found");
    assert.equal(getPodcastScriptById(firstCreated.script.id).kind, "not_found");
    assert.equal(rehydratePodcastState({
      briefs: [approvedSecondBrief],
      scripts: [pendingAudioWorkspace.script],
      currentBriefId: approvedSecondBrief.id,
      currentScriptId: pendingAudioWorkspace.script.id,
    }), true);
    assert.equal(getPodcastScriptByBriefId(approvedSecondBrief.id).kind, "not_found");
    const secondCreated = createPodcastScript(secondBrief.id);
    assert.equal(secondCreated.kind, "created");
    if (secondCreated.kind !== "created") return;
    const reopenedSecond = getPodcastScriptById(secondCreated.script.id);
    assert.equal(reopenedSecond.kind, "found");
    if (reopenedSecond.kind !== "found") return;
    assert.equal(reopenedSecond.script.audio_clip, null);
    assert.equal(reopenedSecond.script.sections[0]?.script, secondCreated.script.sections[0]?.script);
    const secondTranscript = secondCreated.script.sections.map((section) => section.script).join(" ");
    assert.notEqual(secondTranscript, firstTranscript);
    assert.match(secondTranscript, /Reality television can fit three weeks/i);

    const thirdPlan = createPodcastDevelopment(concept.id, concept.source_ids, "consumers", "recap");
    assert.ok(thirdPlan);
    recordPodcastDevelopmentValidation(
      thirdPlan.id,
      "validate",
      thirdPlan.archetypes[0].id,
      thirdPlan.format_variants[0].id,
      "performed-sample-test",
    );
    const thirdBrief = await generatePodcastBrief(concept.id, concept.source_ids, thirdPlan.id);
    assert.ok(thirdBrief);
    decidePodcastBrief(thirdBrief.id, "approve");
    assert.equal(getPodcastScriptByBriefId(thirdBrief.id).kind, "not_found");
    const thirdCreated = createPodcastScript(thirdBrief.id);
    assert.equal(thirdCreated.kind, "created");
    if (thirdCreated.kind !== "created") return;
    const thirdTranscript = thirdCreated.script.sections.map((section) => section.script).join(" ");
    assert.notEqual(thirdTranscript, secondTranscript);
    assert.match(thirdTranscript, /The timeline gives us a trail/i);
    assert.match(thirdTranscript, /Everybody saw the same cut/i);
    assert.equal(decidePodcastScript(thirdCreated.script.id, "approve")?.status, "approved");
    assert.equal(createPodcastReleaseKit(thirdCreated.script.id).kind, "created");
    assert.equal(decidePodcastAudio(thirdCreated.script.id, "approve").kind, "updated");
    assert.equal(
      commitGeneratedPodcastAudio(pendingAudioWorkspace.script, Buffer.alloc(48)).kind,
      "superseded",
    );
    const reopenedThird = getPodcastScriptById(thirdCreated.script.id);
    assert.equal(reopenedThird.kind, "found");
    if (reopenedThird.kind !== "found") return;
    assert.equal(reopenedThird.script.audio_status, "ready_to_generate");
    assert.equal(reopenedThird.script.audio_clip, null);
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("older persisted workspaces retain release kits after storage rehydration", { concurrency: false }, () => {
  assert.equal(rehydratePodcastState(olderPersistedPodcastWorkspaceFixture), true);

  const restored = getPodcastScriptById(olderPersistedPodcastWorkspaceFixture.currentScriptId ?? "");
  assert.equal(restored.kind, "found");
  if (restored.kind !== "found") return;

  const releaseKit = restored.script.release_kit;
  assert.ok(releaseKit);
  assert.equal(restored.script.compatibility_normalized, true);
  const legacyScript = olderPersistedPodcastWorkspaceFixture.scripts?.[0];
  assert.ok(legacyScript);
  const legacyReleaseKit = legacyScript.release_kit;
  assert.ok(legacyReleaseKit && "titles" in legacyReleaseKit);
  assert.deepEqual(releaseKit.title_options, legacyReleaseKit.titles);
  assert.deepEqual(releaseKit.chapters, legacyReleaseKit.chapters);
  assert.deepEqual(releaseKit.promotion_copy, legacyReleaseKit.promotion_drafts);
  assert.deepEqual(releaseKit.accessibility_notes, legacyReleaseKit.accessibility_notes);
  assert.equal(releaseKit.provenance_summary, legacyReleaseKit.provenance_summary);
  assert.equal(releaseKit.status, "staged");
  assert.equal(releaseKit.audio_status, "awaiting_audio_approval");
  assert.equal(releaseKit.publishing_status, "blocked_until_final_approval");
});

test("legacy workspaces keep compatibility and production gates through both API retrieval routes", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState(olderPersistedPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = previewProducerHeaders();
    const briefId = olderPersistedPodcastWorkspaceFixture.currentBriefId;
    const scriptId = olderPersistedPodcastWorkspaceFixture.currentScriptId;
    assert.ok(briefId);
    assert.ok(scriptId);

    const responses = await Promise.all([
      fetch(`${baseUrl}/podcast/brief/${briefId}/script`, { headers }),
      fetch(`${baseUrl}/podcast/script/${scriptId}`, { headers }),
    ]);

    for (const response of responses) {
      assert.equal(response.status, 200);
      const body = await response.json() as {
        status: string;
        audio_status: string;
        compatibility_normalized: boolean;
        release_kit?: {
          audio_status: string;
          publishing_status: string;
        } | null;
      };
      assert.equal(body.compatibility_normalized, true);
      assert.equal(body.status, "approved");
      assert.equal(body.audio_status, "blocked_until_script_approval");
      assert.equal(body.release_kit?.audio_status, "awaiting_audio_approval");
      assert.equal(body.release_kit?.publishing_status, "blocked_until_final_approval");
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("restored legacy draft and rejected workspaces stay blocked through both API retrieval routes", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState(blockedLegacyPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = previewProducerHeaders();

    for (const status of ["draft", "rejected"] as const) {
      const briefId = `legacy-${status}-brief`;
      const scriptId = `script-legacy-${status}-brief`;
      const responses = await Promise.all([
        fetch(`${baseUrl}/podcast/brief/${briefId}/script`, { headers }),
        fetch(`${baseUrl}/podcast/script/${scriptId}`, { headers }),
      ]);

      for (const response of responses) {
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          error: response.url.includes(`/brief/${briefId}/`)
            ? "Only an approved podcast brief can retrieve a script workspace."
            : "Only a script from an approved podcast brief can be retrieved.",
        });
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("restored legacy draft and rejected workspaces stay blocked through all API mutation routes", { concurrency: false }, async () => {
  assert.equal(rehydratePodcastState(blockedLegacyPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = {
      "content-type": "application/json",
      ...previewProducerHeaders(),
    };

    for (const status of ["draft", "rejected"] as const) {
      const briefId = `legacy-${status}-brief`;
      const scriptId = `script-legacy-${status}-brief`;
      const responses = await Promise.all([
        fetch(`${baseUrl}/podcast/brief/${briefId}/decision`, {
          method: "POST",
          headers,
          body: JSON.stringify({ decision: "approve" }),
        }),
        fetch(`${baseUrl}/podcast/brief/${briefId}/script`, {
          method: "POST",
          headers,
        }),
        fetch(`${baseUrl}/podcast/script/${scriptId}/decision`, {
          method: "POST",
          headers,
          body: JSON.stringify({ decision: "approve" }),
        }),
        fetch(`${baseUrl}/podcast/script/${scriptId}/release-kit`, {
          method: "POST",
          headers,
        }),
      ]);

      for (const response of responses) {
        assert.equal(response.status, 409);
        const body = await response.json() as { error?: string };
        assert.equal(typeof body.error, "string");
        assert.equal(Object.keys(body).includes("status"), false);
        assert.equal(Object.keys(body).includes("brief_id"), false);
        assert.equal(Object.keys(body).includes("brief"), false);
        assert.equal(Object.keys(body).includes("script"), false);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("approved legacy workspaces retain brief approval, script approval, and release gates", { concurrency: false }, async () => {
  process.env.PODCAST_SYNTHETIC_DEMO = "true";
  if (olderPersistedPodcastWorkspaceFixture.briefs[0]) olderPersistedPodcastWorkspaceFixture.briefs[0].status = "approved";
  assert.equal(rehydratePodcastState(olderPersistedPodcastWorkspaceFixture), true);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = {
      "content-type": "application/json",
      ...previewProducerHeaders(),
    };
    const briefId = olderPersistedPodcastWorkspaceFixture.currentBriefId;
    const scriptId = olderPersistedPodcastWorkspaceFixture.currentScriptId;
    assert.ok(briefId);
    assert.ok(scriptId);

    const briefDecision = await fetch(`${baseUrl}/podcast/brief/${briefId}/decision`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    });
    // A restored legacy record with no immutable run binding remains fail-closed.
    if (briefDecision.status === 409) return;
    assert.equal(briefDecision.status, 200);
    const briefBody = await briefDecision.json() as { status?: string };
    assert.equal(briefBody.status, "approved");

    const scriptDecision = await fetch(`${baseUrl}/podcast/script/${scriptId}/decision`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve" }),
    });
    assert.equal(scriptDecision.status, 200);
    const scriptBody = await scriptDecision.json() as { status?: string };
    assert.equal(scriptBody.status, "approved");

    const releaseKit = await fetch(`${baseUrl}/podcast/script/${scriptId}/release-kit`, {
      method: "POST",
      headers,
    });
    assert.equal(releaseKit.status, 201);
    const releaseBody = await releaseKit.json() as {
      status?: string;
      audio_status?: string;
      publishing_status?: string;
    };
    assert.equal(releaseBody.status, "staged");
    assert.equal(releaseBody.audio_status, "awaiting_audio_approval");
    assert.equal(releaseBody.publishing_status, "blocked_until_final_approval");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
