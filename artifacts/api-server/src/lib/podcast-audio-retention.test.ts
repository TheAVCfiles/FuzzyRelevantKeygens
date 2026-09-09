import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPodcastAudioRetentionInventory,
  cleanupUnreferencedPodcastAudio,
  type PodcastAudioCleanupDependencies,
} from "./podcast-persistence";

const prefix = "podcast-audio";
const old = "2026-01-01T00:00:00.000Z";
const recent = "2026-01-09T23:00:00.000Z";
const now = new Date("2026-01-10T00:00:00.000Z");
const sha = (character: string) => character.repeat(64);
const objectName = (clipId: string, hash: string) => `${prefix}/${clipId}/${hash}.wav`;

test("inventory protects retained Cut Keys, PostgreSQL assets, and ambiguous script clips", () => {
  const retained = objectName("clip-retained", sha("a"));
  const asset = objectName("clip-asset", sha("b"));
  const ambiguous = objectName("clip-ambiguous", sha("c"));
  const orphan = objectName("clip-orphan", sha("d"));
  const fresh = objectName("clip-fresh", sha("e"));
  const malformed = `${prefix}/unexpected.txt`;
  const inventory = buildPodcastAudioRetentionInventory({
    prefix,
    now,
    retentionMs: 24 * 60 * 60 * 1000,
    state: {
      scripts: [{ audio_clip: { id: "clip-ambiguous" } }],
      cutKeys: [{ clip_id: "clip-retained", audio_sha256: sha("a") }],
      audioAssets: [{ clipId: "clip-asset", sha256: sha("b") }],
    },
    objects: [
      { name: retained, updated: old },
      { name: asset, updated: old },
      { name: ambiguous, updated: old },
      { name: orphan, updated: old },
      { name: fresh, updated: recent },
      { name: malformed, updated: old },
    ],
  });

  assert.deepEqual(inventory.protectedObjects, [retained, asset, ambiguous]);
  assert.deepEqual(inventory.candidateObjects, [orphan]);
  assert.deepEqual(inventory.recentObjects, [fresh]);
  assert.deepEqual(inventory.invalidObjects, [malformed]);
});

test("cleanup is dry-run by default and never deletes candidates", async () => {
  const orphan = objectName("clip-orphan", sha("d"));
  const deleted: string[] = [];
  const dependencies: PodcastAudioCleanupDependencies = {
    loadState: async () => ({ state: { scripts: [] }, revision: 1, updatedAt: now }),
    listObjects: async () => [{ name: orphan, updated: old, generation: "1" }],
    getObject: async (name) => ({ name, updated: old, generation: "1" }),
    deleteObject: async (name) => { deleted.push(name); return "deleted"; },
  };

  const report = await cleanupUnreferencedPodcastAudio({ now, retentionMs: 0 }, dependencies);
  assert.equal(report.dryRun, true);
  assert.deepEqual(report.candidateObjects, [orphan]);
  assert.deepEqual(report.deletedObjects, []);
  assert.deepEqual(deleted, []);
});

test("apply rechecks PostgreSQL protection before each deletion", async () => {
  const candidate = objectName("clip-raced", sha("f"));
  let loads = 0;
  const deleted: string[] = [];
  const dependencies: PodcastAudioCleanupDependencies = {
    loadState: async () => ({
      state: loads++ === 0
        ? { scripts: [] }
        : { scripts: [], cutKeys: [{ clip_id: "clip-raced", audio_sha256: sha("f") }] },
      revision: loads,
      updatedAt: now,
    }),
    listObjects: async () => [{ name: candidate, updated: old, generation: "1" }],
    getObject: async (name) => ({ name, updated: old, generation: "1" }),
    deleteObject: async (name) => { deleted.push(name); return "deleted"; },
  };

  const report = await cleanupUnreferencedPodcastAudio({ dryRun: false, now, retentionMs: 0 }, dependencies);
  assert.deepEqual(report.recheckProtectedObjects, [candidate]);
  assert.deepEqual(report.deletedObjects, []);
  assert.deepEqual(deleted, []);
});

test("apply deletes only old unreferenced objects and remains idempotent", async () => {
  const orphan = objectName("clip-idempotent", sha("9"));
  const objects = new Map([[orphan, "1"]]);
  const dependencies: PodcastAudioCleanupDependencies = {
    loadState: async () => ({ state: { scripts: [] }, revision: 1, updatedAt: now }),
    listObjects: async () => [...objects].map(([name, generation]) => ({ name, updated: old, generation })),
    getObject: async (name) => objects.has(name) ? { name, updated: old, generation: objects.get(name) } : null,
    deleteObject: async (name) => { objects.delete(name); return "deleted"; },
  };

  const first = await cleanupUnreferencedPodcastAudio({ dryRun: false, now, retentionMs: 0 }, dependencies);
  const second = await cleanupUnreferencedPodcastAudio({ dryRun: false, now, retentionMs: 0 }, dependencies);
  assert.deepEqual(first.deletedObjects, [orphan]);
  assert.deepEqual(second.deletedObjects, []);
  assert.equal(second.scanned, 0);
});

test("cleanup aborts when PostgreSQL state is unavailable or malformed", async () => {
  const unavailable: PodcastAudioCleanupDependencies = {
    loadState: async () => null,
    listObjects: async () => [],
    getObject: async () => null,
    deleteObject: async () => "missing",
  };
  await assert.rejects(
    cleanupUnreferencedPodcastAudio({}, unavailable),
    /state is unavailable/,
  );

  const malformed: PodcastAudioCleanupDependencies = {
    loadState: async () => ({ state: { scripts: "not-an-array" }, revision: 1, updatedAt: now }),
    listObjects: async () => [],
    getObject: async () => null,
    deleteObject: async () => "missing",
  };
  await assert.rejects(
    cleanupUnreferencedPodcastAudio({}, malformed),
    /state is malformed/,
  );
});

test("apply refuses to delete an object generation replaced after inventory", async () => {
  const raced = objectName("clip-overwritten", sha("8"));
  const deleted: string[] = [];
  const dependencies: PodcastAudioCleanupDependencies = {
    loadState: async () => ({ state: { scripts: [] }, revision: 1, updatedAt: now }),
    listObjects: async () => [{ name: raced, updated: old, generation: "1" }],
    getObject: async (name) => ({ name, updated: old, generation: "2" }),
    deleteObject: async (name) => { deleted.push(name); return "deleted"; },
  };

  const report = await cleanupUnreferencedPodcastAudio({ dryRun: false, now, retentionMs: 0 }, dependencies);
  assert.deepEqual(report.recheckChangedObjects, [raced]);
  assert.deepEqual(report.deletedObjects, []);
  assert.deepEqual(deleted, []);
});

test("generation precondition race is a safe skip rather than a failure", async () => {
  const raced = objectName("clip-delete-race", sha("7"));
  const dependencies: PodcastAudioCleanupDependencies = {
    loadState: async () => ({ state: { scripts: [] }, revision: 1, updatedAt: now }),
    listObjects: async () => [{ name: raced, updated: old, generation: "1" }],
    getObject: async (name) => ({ name, updated: old, generation: "1" }),
    deleteObject: async () => "changed",
  };

  const report = await cleanupUnreferencedPodcastAudio({ dryRun: false, now, retentionMs: 0 }, dependencies);
  assert.deepEqual(report.recheckChangedObjects, [raced]);
  assert.deepEqual(report.deletedObjects, []);
  assert.deepEqual(report.failedObjects, []);
});