import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSafePodcastDraft,
  createPodcastScript,
  decidePodcastBrief,
  decidePodcastScript,
  generatePodcastBrief,
  getPodcastRoom,
  isPodcastEvidenceSufficient,
  podcastSources,
} from "./podcast-fixtures";

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