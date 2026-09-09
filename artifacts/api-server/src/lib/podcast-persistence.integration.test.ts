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
    const state = {
      cutKeys: [{
        key: "cut-durability-restart",
        clip_id: clipId,
        audio_sha256: sha256,
        superseded_by: null,
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