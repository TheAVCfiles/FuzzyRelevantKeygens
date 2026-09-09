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
    };
    const manifestSha256 = createHash("sha256").update(JSON.stringify(canonicalManifest)).digest("hex");
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
    };

    try {
      const revision = await savePodcastStateToDatabase(state, null);
      assert.equal(revision, 1);
      await uploadPodcastAudio(clipId, wav);

      // A fresh load has no dependency on the compatibility JSON or WAV paths.
      const restored = await loadPodcastStateFromDatabase();
      assert.deepEqual(restored?.state, state);
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