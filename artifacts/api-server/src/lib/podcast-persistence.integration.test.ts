import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  deletePodcastDurabilityTestData,
  getPodcastAudioFile,
  loadPodcastStateFromDatabase,
  savePodcastStateToDatabase,
  uploadPodcastAudio,
} from "./podcast-persistence";

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((canonical, key) => {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) canonical[key] = canonicalJsonValue(item);
      return canonical;
    }, {});
}

function canonicalSha256(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalJsonValue(value)))
    .digest("hex");
}

test(
  "PostgreSQL and App Storage restore the same Cut Key without local files",
  { skip: process.env.PODCAST_DURABILITY_TEST !== "true" },
  async () => {
    const namespace = `${process.pid}-${Date.now()}`;
    process.env.PODCAST_STATE_ID = `autography-podcast-durability-test-${namespace}`;
    process.env.PODCAST_AUDIO_PREFIX = `podcast-durability-tests/${namespace}`;
    const clipId = "clip-durability-restart";
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(256, 0x5a)]);
    const sha256 = createHash("sha256").update(wav).digest("hex");
    const transcript = "Durable podcast transcript.";
    const approvalRecord = (
      recordType: "SCRIPT_APPROVED" | "AUDIO_RENDER_AUTHORIZED",
      artifactType: "script" | "audio",
    ) => {
      const record = {
        record_type: recordType,
        artifact_type: artifactType,
        artifact_id: "durability-script",
        reviewer_reference: canonicalSha256(`reviewer-${artifactType}`),
        decided_at: "2026-09-09T00:00:00.000Z",
        subject_sha256: canonicalSha256(`subject-${artifactType}`),
      };
      return { ...record, record_sha256: canonicalSha256(record) };
    };
    const scriptApproval = approvalRecord("SCRIPT_APPROVED", "script");
    const audioApproval = approvalRecord("AUDIO_RENDER_AUTHORIZED", "audio");
    const canonicalManifest = {
      clip_id: clipId,
      transcript,
      transcript_sha256: createHash("sha256").update(transcript).digest("hex"),
      source_ids: ["durability-source"],
      generated_at: "2026-09-09T00:00:00.000Z",
      production: { synthetic: true, provider: "Google Gemini", model: "Gemini TTS" },
      voice_disclosure: "Synthetic house voices; no cloning or impersonation.",
      format_disclosure: "Short evidence-backed performed podcast sample.",
      audio_sha256: sha256,
      integrity_disclaimer: "This manifest verifies artifact lineage and integrity, not the truth of any claim.",
      manifest_version: 2 as const,
      source_metadata: [{
        id: "durability-source",
        url: "https://example.test/durability-source",
        title: "Durability source",
        retrieved_at: "2026-09-09T00:00:00.000Z",
        source_type: "public_web",
        classification: "source_backed" as const,
        policy_reference: "podcast-current-context-policy-v1",
        aggregate_summary: "A bounded public summary.",
        evidence_gaps: ["Intent remains unresolved."],
        what_it_supports: "A bounded public observation.",
        what_remains_uncertain: "The source does not establish intent.",
      }],
      claim_support: [{
        claim_id: "claim-01",
        segment: "evidence",
        speaker: "BACKSTAGE" as const,
        claim_text: transcript,
        source_ids: ["durability-source"],
        classification: "source_backed" as const,
      }],
      approval_records: [scriptApproval, audioApproval],
      execution_envelope: [{
        agent: "source_scout" as const,
        provider: "Google Gemini API",
        framework: "Google ADK (@google/adk)",
        model: "gemini-3-flash-preview",
        execution_id: "durability-adk-execution",
        tools: ["googleSearch"],
        latency_ms: 10,
        status: "completed" as const,
        activity: "Completed isolated persistence evidence.",
        transport: { api: "gemini_developer_api" as const, auth: "api_key" as const },
      }],
    };
    const manifestSha256 = canonicalSha256(canonicalManifest);
    const state = {
      cutKeys: [{
        key: `cut-${manifestSha256}`,
        manifest_sha256: manifestSha256,
        audio_url: `/api/podcast/cut-keys/cut-${manifestSha256}/audio`,
        ...canonicalManifest,
      }],
      scripts: [{
        audio_status: "generated",
        audio_clip: {
          id: clipId,
        },
      }],
      approvalReceipts: [
        {
          key: "script:durability-script",
          receipt: { ...scriptApproval, stage: "script" as const, reviewer: "durability-script-reviewer" },
        },
        {
          key: "audio:durability-script",
          receipt: { ...audioApproval, stage: "audio" as const, reviewer: "durability-audio-reviewer" },
        },
      ],
    };

    try {
      const revision = await savePodcastStateToDatabase(state, null);
      assert.equal(revision, 1);
      await uploadPodcastAudio(clipId, wav);

      // A fresh load has no dependency on the compatibility JSON or WAV paths.
      const restored = await loadPodcastStateFromDatabase();
      assert.deepEqual(restored?.state, state);
      assert.equal(
        (restored?.state as typeof state).approvalReceipts[1]?.receipt.subject_sha256,
        audioApproval.subject_sha256,
      );
      assert.equal(restored?.revision, 1);
      const {
        getPodcastAudioFileForCutKey,
        getPublicPodcastAudioCutKey,
        getPublicPodcastCutKey,
      } = await import("./podcast-fixtures");
      const publicManifest = await getPublicPodcastCutKey(`cut-${manifestSha256}`);
      assert.deepEqual(publicManifest, state.cutKeys[0]);
      const activeManifest = await getPublicPodcastAudioCutKey(`cut-${manifestSha256}`);
      assert.deepEqual(activeManifest, state.cutKeys[0]);
      assert.ok(activeManifest);
      const publicAudio = await getPodcastAudioFileForCutKey(activeManifest);
      assert.ok(publicAudio);
      const storedAudio = await getPodcastAudioFile(clipId, sha256);
      assert.ok(storedAudio);
      const [restoredWav] = await storedAudio.download();
      assert.equal(createHash("sha256").update(restoredWav).digest("hex"), sha256);
      assert.deepEqual(restoredWav, wav);
    } finally {
      await deletePodcastDurabilityTestData(clipId, sha256);
    }
  },
);