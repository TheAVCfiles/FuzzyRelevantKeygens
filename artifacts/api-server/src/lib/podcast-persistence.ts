import { db, podcastStateTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { logger } from "./logger";
import { objectStorageClient } from "./object-storage-client";

export const DEFAULT_PODCAST_AUDIO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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

type PodcastAudioObject = {
  name: string;
  updated?: string | Date;
  generation?: string | number;
};

type PodcastAudioReferenceState = {
  scripts: unknown[];
  cutKeys?: unknown[];
  audioAssets?: unknown[];
};

export type PodcastAudioRetentionInventory = {
  scanned: number;
  protectedObjects: string[];
  recentObjects: string[];
  invalidObjects: string[];
  candidateObjects: string[];
};

export type PodcastAudioCleanupReport = PodcastAudioRetentionInventory & {
  dryRun: boolean;
  retentionMs: number;
  deletedObjects: string[];
  recheckProtectedObjects: string[];
  recheckChangedObjects: string[];
  missingObjects: string[];
  failedObjects: { name: string; error: string }[];
};

export type PodcastAudioCleanupDependencies = {
  loadState: () => Promise<StoredPodcastState | null>;
  listObjects: (prefix: string) => Promise<PodcastAudioObject[]>;
  getObject: (name: string) => Promise<PodcastAudioObject | null>;
  deleteObject: (name: string, generation: string | number) => Promise<"deleted" | "changed" | "missing">;
};

function retentionAudioPrefix() {
  const prefix = audioPrefix();
  if (
    !prefix ||
    prefix.startsWith("/") ||
    prefix.endsWith("/") ||
    prefix.split("/").some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment))
  ) {
    throw new Error("PODCAST_AUDIO_PREFIX is not safe for retention cleanup");
  }
  return prefix;
}

function parseAudioObjectName(name: string, prefix: string) {
  const match = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/(clip-[a-zA-Z0-9_-]+)\\/([a-f0-9]{64})\\.wav$`,
  ).exec(name);
  return match ? { clipId: match[1]!, sha256: match[2]! } : null;
}

function parseReferenceState(input: unknown): PodcastAudioReferenceState {
  if (!input || typeof input !== "object") throw new Error("Podcast state is unavailable; audio cleanup aborted");
  const state = input as Partial<PodcastAudioReferenceState>;
  if (
    !Array.isArray(state.scripts) ||
    (state.cutKeys !== undefined && !Array.isArray(state.cutKeys)) ||
    (state.audioAssets !== undefined && !Array.isArray(state.audioAssets))
  ) {
    throw new Error("Podcast state is malformed; audio cleanup aborted");
  }
  return state as PodcastAudioReferenceState;
}

function protectedPodcastAudio(stateInput: unknown, objects: PodcastAudioObject[], prefix: string) {
  const state = parseReferenceState(stateInput);
  const exact = new Set<string>();
  const protectedClipIds = new Set<string>();
  const referencedShaByClip = new Map<string, Set<string>>();

  const rememberExact = (clipId: unknown, sha256: unknown) => {
    if (typeof clipId !== "string" || !/^clip-[a-zA-Z0-9_-]+$/.test(clipId)) return;
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) return;
    exact.add(`${prefix}/${clipId}/${sha256}.wav`);
    const hashes = referencedShaByClip.get(clipId) ?? new Set<string>();
    hashes.add(sha256);
    referencedShaByClip.set(clipId, hashes);
  };

  for (const value of state.cutKeys ?? []) {
    if (!value || typeof value !== "object") continue;
    const cutKey = value as { clip_id?: unknown; audio_sha256?: unknown };
    rememberExact(cutKey.clip_id, cutKey.audio_sha256);
  }
  for (const value of state.audioAssets ?? []) {
    if (!value || typeof value !== "object") continue;
    const asset = value as { clipId?: unknown; sha256?: unknown };
    rememberExact(asset.clipId, asset.sha256);
  }
  for (const value of state.scripts) {
    if (!value || typeof value !== "object") continue;
    const script = value as { audio_clip?: { id?: unknown } | null };
    const clipId = script.audio_clip?.id;
    if (typeof clipId !== "string" || !/^clip-[a-zA-Z0-9_-]+$/.test(clipId)) continue;
    const knownHashes = referencedShaByClip.get(clipId);
    if (!knownHashes || knownHashes.size !== 1) protectedClipIds.add(clipId);
  }

  for (const object of objects) {
    const parsed = parseAudioObjectName(object.name, prefix);
    if (parsed && protectedClipIds.has(parsed.clipId)) exact.add(object.name);
  }
  return exact;
}

export function buildPodcastAudioRetentionInventory(input: {
  state: unknown;
  objects: PodcastAudioObject[];
  now?: Date;
  retentionMs?: number;
  prefix?: string;
}): PodcastAudioRetentionInventory {
  const now = input.now ?? new Date();
  const retentionMs = input.retentionMs ?? DEFAULT_PODCAST_AUDIO_RETENTION_MS;
  const prefix = input.prefix ?? retentionAudioPrefix();
  if (!Number.isFinite(retentionMs) || retentionMs < 0) throw new Error("Podcast audio retention window must be non-negative");

  const protectedNames = protectedPodcastAudio(input.state, input.objects, prefix);
  const protectedObjects: string[] = [];
  const recentObjects: string[] = [];
  const invalidObjects: string[] = [];
  const candidateObjects: string[] = [];

  for (const object of input.objects) {
    if (!parseAudioObjectName(object.name, prefix)) {
      invalidObjects.push(object.name);
      continue;
    }
    if (protectedNames.has(object.name)) {
      protectedObjects.push(object.name);
      continue;
    }
    const updatedAt = object.updated instanceof Date ? object.updated : new Date(object.updated ?? "");
    if (!Number.isFinite(updatedAt.getTime()) || now.getTime() - updatedAt.getTime() < retentionMs) {
      recentObjects.push(object.name);
      continue;
    }
    candidateObjects.push(object.name);
  }

  return {
    scanned: input.objects.length,
    protectedObjects,
    recentObjects,
    invalidObjects,
    candidateObjects,
  };
}

const defaultPodcastAudioCleanupDependencies: PodcastAudioCleanupDependencies = {
  loadState: loadPodcastStateFromDatabase,
  async listObjects(prefix) {
    const [files] = await bucket().getFiles({ prefix: `${prefix}/` });
    return files.map((file) => ({
      name: file.name,
      updated: file.metadata.updated,
      generation: file.metadata.generation,
    }));
  },
  async getObject(name) {
    const file = bucket().file(name);
    try {
      const [metadata] = await file.getMetadata();
      return { name, updated: metadata.updated, generation: metadata.generation };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        Number((error as { code?: unknown }).code) === 404
      ) return null;
      throw error;
    }
  },
  async deleteObject(name, generation) {
    try {
      await bucket().file(name).delete({
        ignoreNotFound: true,
        ifGenerationMatch: generation,
      });
      return "deleted";
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? Number((error as { code?: unknown }).code)
        : null;
      if (code === 404) return "missing";
      if (code === 412) return "changed";
      throw error;
    }
  },
};

export async function cleanupUnreferencedPodcastAudio(
  input: {
    dryRun?: boolean;
    retentionMs?: number;
    now?: Date;
  } = {},
  dependencies: PodcastAudioCleanupDependencies = defaultPodcastAudioCleanupDependencies,
): Promise<PodcastAudioCleanupReport> {
  const dryRun = input.dryRun ?? true;
  const retentionMs = input.retentionMs ?? DEFAULT_PODCAST_AUDIO_RETENTION_MS;
  const now = input.now ?? new Date();
  const prefix = retentionAudioPrefix();
  const stored = await dependencies.loadState();
  if (!stored) throw new Error("Podcast state is unavailable; audio cleanup aborted");
  const objects = await dependencies.listObjects(prefix);
  const inventory = buildPodcastAudioRetentionInventory({
    state: stored.state,
    objects,
    now,
    retentionMs,
    prefix,
  });
  const report: PodcastAudioCleanupReport = {
    ...inventory,
    dryRun,
    retentionMs,
    deletedObjects: [],
    recheckProtectedObjects: [],
    recheckChangedObjects: [],
    missingObjects: [],
    failedObjects: [],
  };
  const inventoriedObjects = new Map(objects.map((object) => [object.name, object]));

  for (const name of inventory.candidateObjects) {
    if (dryRun) {
      logger.info({ object_name: name, retention_ms: retentionMs }, "Podcast audio cleanup dry-run candidate");
      continue;
    }
    try {
      const inventoried = inventoriedObjects.get(name);
      const current = await dependencies.getObject(name);
      if (!current) {
        report.missingObjects.push(name);
        logger.info({ object_name: name }, "Podcast audio cleanup object already absent");
        continue;
      }
      const updatedAt = current.updated instanceof Date ? current.updated : new Date(current.updated ?? "");
      if (
        inventoried?.generation === undefined ||
        current.generation === undefined ||
        String(inventoried.generation) !== String(current.generation) ||
        !Number.isFinite(updatedAt.getTime()) ||
        now.getTime() - updatedAt.getTime() < retentionMs
      ) {
        report.recheckChangedObjects.push(name);
        logger.info({ object_name: name }, "Podcast audio cleanup skipped changed or newly recent object");
        continue;
      }
      const latest = await dependencies.loadState();
      if (!latest) throw new Error("Podcast state disappeared during cleanup");
      const protectedNames = protectedPodcastAudio(latest.state, objects, prefix);
      if (protectedNames.has(name)) {
        report.recheckProtectedObjects.push(name);
        logger.info({ object_name: name }, "Podcast audio cleanup skipped newly protected object");
        continue;
      }
      const deletion = await dependencies.deleteObject(name, current.generation);
      if (deletion === "deleted") {
        report.deletedObjects.push(name);
        logger.info({ object_name: name }, "Podcast audio cleanup deleted unreferenced object");
      } else if (deletion === "changed") {
        report.recheckChangedObjects.push(name);
        logger.info({ object_name: name }, "Podcast audio cleanup skipped object replaced during deletion");
      } else {
        report.missingObjects.push(name);
        logger.info({ object_name: name }, "Podcast audio cleanup object already absent");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failedObjects.push({ name, error: message });
      logger.error({ object_name: name, error: message }, "Podcast audio cleanup failed for object");
    }
  }

  logger.info({
    dry_run: dryRun,
    retention_ms: retentionMs,
    scanned: report.scanned,
    protected: report.protectedObjects.length,
    recent: report.recentObjects.length,
    invalid: report.invalidObjects.length,
    candidates: report.candidateObjects.length,
    deleted: report.deletedObjects.length,
    recheck_protected: report.recheckProtectedObjects.length,
    recheck_changed: report.recheckChangedObjects.length,
    missing: report.missingObjects.length,
    failed: report.failedObjects.length,
  }, "Podcast audio cleanup completed");
  return report;
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