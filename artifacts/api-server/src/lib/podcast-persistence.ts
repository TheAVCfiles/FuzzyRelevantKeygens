import { db, podcastStateTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { logger } from "./logger";
import { objectStorageClient } from "./object-storage-client";

function stateId() {
  return process.env.PODCAST_STATE_ID ?? "autography-podcast-room";
}

function audioPrefix() {
  return process.env.PODCAST_AUDIO_PREFIX ?? "podcast-audio";
}

function bucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is required");
  return objectStorageClient.bucket(bucketId);
}

function audioObjectName(clipId: string, sha256: string) {
  if (!/^clip-[a-zA-Z0-9_-]+$/.test(clipId)) throw new Error("Invalid podcast clip id");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Invalid podcast audio SHA-256");
  return `${audioPrefix()}/${clipId}/${sha256}.wav`;
}

export type StoredPodcastState = {
  state: unknown;
  revision: number;
  updatedAt: Date;
};

export async function loadPodcastStateFromDatabase(): Promise<StoredPodcastState | null> {
  const rows = await db
    .select({
      state: podcastStateTable.state,
      revision: podcastStateTable.revision,
      updatedAt: podcastStateTable.updatedAt,
    })
    .from(podcastStateTable)
    .where(eq(podcastStateTable.id, stateId()))
    .limit(1);
  return rows[0] ?? null;
}

export async function savePodcastStateToDatabase(
  state: unknown,
  expectedRevision: number | null,
): Promise<number> {
  if (expectedRevision === null) {
    const inserted = await db
      .insert(podcastStateTable)
      .values({ id: stateId(), state, revision: 1, updatedAt: new Date() })
      .onConflictDoNothing()
      .returning({ revision: podcastStateTable.revision });
    if (!inserted[0]) throw new Error("Podcast state changed on another instance; retry the request.");
    return inserted[0].revision;
  }
  const nextRevision = expectedRevision + 1;
  const updated = await db
    .update(podcastStateTable)
    .set({ state, revision: nextRevision, updatedAt: new Date() })
    .where(and(
      eq(podcastStateTable.id, stateId()),
      eq(podcastStateTable.revision, expectedRevision),
    ))
    .returning({ revision: podcastStateTable.revision });
  if (!updated[0]) throw new Error("Podcast state changed on another instance; retry the request.");
  return updated[0].revision;
}

export async function uploadPodcastAudio(clipId: string, wav: Buffer): Promise<void> {
  const sha256 = createHash("sha256").update(wav).digest("hex");
  await bucket().file(audioObjectName(clipId, sha256)).save(wav, {
    contentType: "audio/wav",
    resumable: false,
    metadata: {
      cacheControl: "private, no-store",
      metadata: { audioSha256: sha256 },
    },
  });
}

export async function migrateLocalPodcastAudio(
  clipId: string,
  localPath: string,
  expectedSha256: string,
): Promise<boolean> {
  const file = bucket().file(audioObjectName(clipId, expectedSha256));
  const [exists] = await file.exists();
  if (exists && await podcastAudioMatches(file, expectedSha256)) return true;
  if (!existsSync(localPath)) return false;
  const wav = readFileSync(localPath);
  const localSha256 = createHash("sha256").update(wav).digest("hex");
  if (localSha256 !== expectedSha256) {
    throw new Error(`Local podcast audio integrity check failed for ${clipId}`);
  }
  await file.save(wav, {
    contentType: "audio/wav",
    resumable: false,
    metadata: {
      cacheControl: "private, no-store",
      metadata: { audioSha256: expectedSha256 },
    },
  });
  if (!exists) {
    logger.info({ clipId, source: basename(localPath) }, "Migrated podcast audio to App Storage");
  } else {
    logger.warn({ clipId, source: basename(localPath) }, "Replaced mismatched podcast audio in App Storage");
  }
  return true;
}

async function podcastAudioMatches(
  file: ReturnType<ReturnType<typeof bucket>["file"]>,
  expectedSha256: string,
) {
  const [metadata] = await file.getMetadata();
  const storedSha256 = metadata.metadata?.audioSha256;
  if (storedSha256 === expectedSha256) return true;
  const [contents] = await file.download();
  const actualSha256 = createHash("sha256").update(contents).digest("hex");
  if (actualSha256 !== expectedSha256) return false;
  await file.setMetadata({
    cacheControl: "private, no-store",
    metadata: { ...metadata.metadata, audioSha256: expectedSha256 },
  });
  return true;
}

export async function getPodcastAudioFile(clipId: string, expectedSha256: string) {
  const file = bucket().file(audioObjectName(clipId, expectedSha256));
  const [exists] = await file.exists();
  if (!exists) return null;
  return await podcastAudioMatches(file, expectedSha256) ? file : null;
}

export async function deletePodcastDurabilityTestData(clipId: string, sha256: string) {
  if (
    process.env.PODCAST_DURABILITY_TEST !== "true" ||
    !stateId().startsWith("autography-podcast-durability-test-") ||
    !audioPrefix().startsWith("podcast-durability-tests/")
  ) {
    throw new Error("Durability test cleanup is restricted to isolated test namespaces.");
  }
  await bucket().file(audioObjectName(clipId, sha256)).delete({ ignoreNotFound: true });
  await db.delete(podcastStateTable).where(eq(podcastStateTable.id, stateId()));
}