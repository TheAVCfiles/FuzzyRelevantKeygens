import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";

import app from "../app";
import {
  buildSafePodcastDraft,
  blockedLegacyPodcastWorkspaceFixture,
  createPodcastFilterPreset,
  createPodcastScript,
  createPodcastReleaseKit,
  decidePodcastAudio,
  deletePodcastFilterPreset,
  decidePodcastBrief,
  decidePodcastScript,
  generatePodcastBrief,
  getPodcastScriptByBriefId,
  getPodcastScriptById,
  getPodcastRoom,
  searchPodcastContexts,
  isPodcastEvidenceSufficient,
  podcastSources,
  olderPersistedPodcastWorkspaceFixture,
  renamePodcastFilterPreset,
  rehydratePodcastState,
  restorePodcastState,
} from "./podcast-fixtures";

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

test("brief fallback preserves URL and retrieval provenance", { concurrency: false }, async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
  const room = getPodcastRoom();
  const concept = room.concepts[0];
  assert.ok(concept);
  const brief = await generatePodcastBrief(concept.id, concept.source_ids);

  assert.ok(brief);
  assert.equal(brief.generated_mode, "fixture_fallback");
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

test("entertainment context search ranks cited packages and keeps speculation explicit", { concurrency: false }, () => {
  const result = searchPodcastContexts(
    "cutting room edit context",
    "clients",
    "development",
  );
  assert.equal(result.search_mode, "curated_synthetic_index");
  assert.equal(result.audience, "clients");
  assert.ok(result.results.length > 0);
  for (const item of result.results) {
    assert.ok(item.sources.length > 0);
    assert.ok(item.concept.source_ids.every((id) => podcastSources.some((source) => source.id === id)));
    assert.match(item.speculation, /unverified/i);
    assert.ok(item.safest_next_reviewer.length > 0);
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

test("brief and script decisions are explicit gates and do not create artifacts", { concurrency: false }, async () => {
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
  assert.equal(rejectedScript?.audio_status, "blocked_until_script_approval");
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
    const headers = {
      "x-autography-role": "producer",
      "x-autography-user": "route-regression-test",
    };
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
    const headers = {
      "x-autography-role": "producer",
      "x-autography-user": "route-regression-test",
    };

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
      "x-autography-role": "producer",
      "x-autography-user": "route-regression-test",
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
      "x-autography-role": "producer",
      "x-autography-user": "route-regression-test",
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
