import { GoogleGenAI } from "@google/genai";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PodcastArchetype,
  PodcastBrief,
  PodcastAudioClip,
  PodcastContextSearchResponse,
  PodcastConcept,
  PodcastCutKey,
  PodcastCuttingRoomAttestation,
  PodcastGroundedRun,
  PodcastDevelopmentPlan,
  PodcastFilterPreset,
  PodcastFormatVariant,
  PodcastGroundingSource,
  PodcastLiveSnapshot,
  PodcastReleaseKit,
  PodcastScriptWorkspace,
  PodcastSource,
} from "@workspace/api-zod";

import {
  getLiveObservationSnapshot,
  getPodcastDecisionHistory,
  recordAgentStage,
  recordHumanDecision,
} from "./autography-fixtures";
import { logger } from "./logger";
import {
  getPodcastAudioFile,
  loadPodcastStateFromDatabase,
  migrateLocalPodcastAudio,
  savePodcastStateToDatabase,
  uploadPodcastAudio,
} from "./podcast-persistence";

const model = "gemini-3.6-flash";
const currentContextPolicyReference = "podcast-current-context-policy-v1";
const publicWebConsentReference = "public-web-metadata-only-v1";

const now = () => new Date().toISOString();

type PodcastWorkspaceWithCompatibility = PodcastScriptWorkspace & {
  compatibility_normalized: boolean;
  workspace_revision?: string;
};

export const podcastSources: PodcastSource[] = [
  {
    id: "reddit-fixture-001",
    source_url: "https://www.reddit.com/r/television/comments/1abc234/the_reunion_edit_changed_everything/",
    platform: "Reddit",
    community: "r/television",
    post_title: "The reunion edit changed everything — what did the audience actually miss?",
    timestamp: "2026-08-22T14:05:00.000Z",
    retrieved_at: "2026-08-22T14:28:00.000Z",
    engagement: { score: 1840, comments: 312 },
    source_id: "1abc234",
    access_mode: "fixture" as const,
  },
  {
    id: "reddit-fixture-002",
    source_url: "https://www.reddit.com/r/BravoRealHousewives/comments/1def567/why_did_the_reunion_skip_the_context/",
    platform: "Reddit",
    community: "r/BravoRealHousewives",
    post_title: "Why did the reunion skip the context everyone was asking for?",
    timestamp: "2026-08-22T13:42:00.000Z",
    retrieved_at: "2026-08-22T14:29:00.000Z",
    engagement: { score: 965, comments: 178 },
    source_id: "1def567",
    access_mode: "fixture" as const,
  },
  {
    id: "reddit-fixture-003",
    source_url: "https://www.reddit.com/r/podcasts/comments/1ghi890/the_best_reality_tv_recap_is_about_the_edit/",
    platform: "Reddit",
    community: "r/podcasts",
    post_title: "The best reality TV recap is about the edit, not the cast",
    timestamp: "2026-08-22T12:58:00.000Z",
    retrieved_at: "2026-08-22T14:30:00.000Z",
    engagement: { score: 622, comments: 94 },
    source_id: "1ghi890",
    access_mode: "fixture" as const,
  },
  {
    id: "trade-fixture-001",
    source_url: "https://example.com/entertainment-trade/format-compression-and-audience-trust",
    platform: "Entertainment trade",
    community: "format reporting",
    post_title: "Format compression is becoming an audience-trust question",
    timestamp: "2026-08-21T16:00:00.000Z",
    retrieved_at: "2026-08-22T14:31:00.000Z",
    engagement: { score: 740, comments: 36 },
    source_id: "trade-format-001",
    access_mode: "fixture" as const,
    source_class: "trade_reporting",
    evidence_type: "supported_evidence",
  },
  {
    id: "interview-fixture-001",
    source_url: "https://example.com/editor-interview/what-never-makes-the-cut",
    platform: "Interview archive",
    community: "post-production",
    post_title: "Editors describe the context that rarely survives the final cut",
    timestamp: "2026-08-20T13:00:00.000Z",
    retrieved_at: "2026-08-22T14:32:00.000Z",
    engagement: { score: 510, comments: 18 },
    source_id: "interview-edit-001",
    access_mode: "fixture" as const,
    source_class: "verified_expertise",
    evidence_type: "supported_evidence",
  },
  {
    id: "ratings-fixture-001",
    source_url: "https://example.com/audience-lab/recap-retention-patterns",
    platform: "Audience research",
    community: "retention lab",
    post_title: "Context-led recaps show stronger completion than outrage-led summaries",
    timestamp: "2026-08-19T17:30:00.000Z",
    retrieved_at: "2026-08-22T14:33:00.000Z",
    engagement: { score: 430, comments: 12 },
    source_id: "research-retention-001",
    access_mode: "fixture" as const,
    source_class: "synthetic_audience_research",
    evidence_type: "directional_evidence",
  },
  {
    id: "festival-fixture-001",
    source_url: "https://example.com/festival-panel/unscripted-story-ethics",
    platform: "Festival panel",
    community: "unscripted development",
    post_title: "A development panel asks who gets to explain the missing scene",
    timestamp: "2026-08-18T12:00:00.000Z",
    retrieved_at: "2026-08-22T14:34:00.000Z",
    engagement: { score: 385, comments: 24 },
    source_id: "panel-ethics-001",
    access_mode: "fixture" as const,
    source_class: "subject_matter_commentary",
    evidence_type: "interpretation",
  },
];

export const podcastConcepts = [
  {
    id: "concept-edit-context",
    title: "The missing-context problem",
    summary:
      "Listeners are not asking for more reaction. They are asking what the edit leaves out, and whether the timeline can be reconstructed without targeting a person.",
    relevance: 0.96,
    urgency: 0.91,
    engagement: 0.88,
    freshness: 0.94,
    source_diversity: 0.42,
    source_ids: podcastSources.map((source) => source.id),
    observed_signal: "Three public communities are converging on the same editorial question within the current episode window.",
    supported_context: "The signal is about edit compression and missing timeline context; it does not establish intent, truth, or responsibility for any individual.",
    unresolved_questions: [
      "Which timeline details were compressed for format, and which remain unavailable?",
      "What context can be verified before a recap makes the uncertainty sound like a verdict?",
    ],
    recommended_route: "producer_review" as const,
    next_reviewer: "Producer / showrunner",
    confidence_label: "medium · directional",
    freshness_label: "fresh · current episode window",
    status: "ready" as const,
  },
  {
    id: "concept-recap-trust",
    title: "Can a recap be fair when the cut is not neutral?",
    summary:
      "A recurring audience tension: recap culture rewards certainty, while viewers increasingly want the production choices and uncertainty named.",
    relevance: 0.89,
    urgency: 0.78,
    engagement: 0.74,
    freshness: 0.86,
    source_diversity: 0.32,
    source_ids: [podcastSources[0].id, podcastSources[2].id],
    observed_signal: "Two communities are comparing recap fairness with the choices made in the cut.",
    supported_context: "The available sources support a format-level discussion of recap framing, not a claim about a cast member or production motive.",
    unresolved_questions: [
      "Can the episode timeline be reconstructed from verified production context?",
      "Which explanation would clarify the edit without rewarding certainty?",
    ],
    recommended_route: "publicity_clarification" as const,
    next_reviewer: "Publicity / media desk",
    confidence_label: "medium · cross-community pattern",
    freshness_label: "fresh · same episode window",
    status: "ready" as const,
  },
  {
    id: "concept-reaction-fatigue",
    title: "The audience is tired of outrage-shaped recaps",
    summary:
      "Multiple communities are separating genuine confusion from the loudest accusation and looking for a more useful post-episode format.",
    relevance: 0.82,
    urgency: 0.69,
    engagement: 0.67,
    freshness: 0.79,
    source_diversity: 0.28,
    source_ids: [podcastSources[1].id, podcastSources[2].id],
    observed_signal: "Discussion is shifting from outrage-shaped reaction toward requests for a calmer recap format.",
    supported_context: "The sources support an audience-format observation; they do not establish that the broader audience is tired of outrage.",
    unresolved_questions: [
      "Is the shift durable beyond these communities?",
      "Would an experienced recap editor or audience researcher add useful context?",
    ],
    recommended_route: "subject_matter_expert" as const,
    next_reviewer: "Verified audience-research or recap-format expert",
    confidence_label: "low · needs corroboration",
    freshness_label: "recent · limited source diversity",
    status: "needs_review" as const,
  },
  {
    id: "concept-format-trust",
    title: "The cutting-room context audiences now expect",
    summary:
      "Across community, trade, editorial, and research signals, audiences appear to value recaps that explain format choices and clearly name what remains unknowable.",
    relevance: 0.94,
    urgency: 0.83,
    engagement: 0.72,
    freshness: 0.88,
    source_diversity: 0.91,
    source_ids: ["reddit-fixture-001", "trade-fixture-001", "interview-fixture-001", "ratings-fixture-001"],
    observed_signal: "Multiple source classes are asking for format context instead of a louder cast verdict.",
    supported_context: "The evidence supports a discussion of editorial compression, recap design, and audience trust; it does not prove why any scene was cut.",
    unresolved_questions: [
      "Which missing details are format constraints, and which require a first-party clarification?",
      "Does the completion pattern hold outside the synthetic research sample?",
    ],
    recommended_route: "producer_review" as const,
    next_reviewer: "Executive producer / post-production lead",
    confidence_label: "medium-high · cross-source pattern",
    freshness_label: "current · multi-format window",
    status: "ready" as const,
  },
  {
    id: "concept-development-ethics",
    title: "Who should explain the scene that never aired?",
    summary:
      "A development opportunity is emerging around aftershows that separate verified production context, expert interpretation, and questions only participants can answer.",
    relevance: 0.86,
    urgency: 0.71,
    engagement: 0.63,
    freshness: 0.76,
    source_diversity: 0.77,
    source_ids: ["interview-fixture-001", "festival-fixture-001", "reddit-fixture-003"],
    observed_signal: "Editors, development voices, and recap listeners are converging on clearer ownership of explanation.",
    supported_context: "The sources support a format-development discussion, not disclosure of confidential production decisions.",
    unresolved_questions: [
      "Which role can clarify each gap without speaking for a participant?",
      "What context can be shared without exposing protected production material?",
    ],
    recommended_route: "subject_matter_expert" as const,
    next_reviewer: "Format executive / standards reviewer",
    confidence_label: "medium · needs first-party review",
    freshness_label: "recent · development cycle",
    status: "needs_review" as const,
  },
];
const activeGroundedSources: PodcastSource[] = [];
const activeGroundedConcepts: PodcastConcept[] = [];
const syntheticDemoEnabled = () => process.env.PODCAST_SYNTHETIC_DEMO === "true";
const allPodcastSources = () => syntheticDemoEnabled() ? [...activeGroundedSources, ...podcastSources] : [...activeGroundedSources];
const allPodcastConcepts = () => syntheticDemoEnabled() ? [...activeGroundedConcepts, ...podcastConcepts] : [...activeGroundedConcepts];

export const podcastArchetypes: PodcastArchetype[] = [
  {
    id: "investigative-decoder",
    label: "Investigative decoder",
    point_of_view: "Reconstruct what the evidence establishes, what the edit compresses, and what remains unresolved.",
    delivery_guidance: "Precise, curious, and paced around evidence turns rather than accusation.",
    audience_fit: "Listeners who value reported context, chronology, and transparent uncertainty.",
    non_impersonation_disclosure: "Fictional editorial lens only · never based on or performed as a real person.",
  },
  {
    id: "warm-interviewer",
    label: "Warm interviewer",
    point_of_view: "Turn the evidence gap into humane questions that a responsible guest could answer without being cornered.",
    delivery_guidance: "Inviting and clear, with room for pauses, context, and first-party boundaries.",
    audience_fit: "Listeners who stay for emotional clarity and thoughtful conversation.",
    non_impersonation_disclosure: "Fictional editorial lens only · house narration does not clone or imitate a host.",
  },
  {
    id: "culture-critic",
    label: "Culture critic",
    point_of_view: "Connect the immediate signal to broader entertainment formats and audience expectations.",
    delivery_guidance: "Analytical and vivid while distinguishing documented pattern from interpretation.",
    audience_fit: "Listeners interested in media literacy, format choices, and cultural context.",
    non_impersonation_disclosure: "Fictional editorial lens only · no living writer, critic, or performer is imitated.",
  },
  {
    id: "comic-improviser",
    label: "Comic improviser",
    point_of_view: "Use playful format observations to make uncertainty listenable without making a person the punchline.",
    delivery_guidance: "Quick, warm, and self-aware; humor targets the format problem, never an individual.",
    audience_fit: "Listeners who prefer energetic recaps with a clear ethical boundary.",
    non_impersonation_disclosure: "Fictional editorial lens only · no comedian, actor, or public figure is imitated.",
  },
];

let currentBrief: PodcastBrief | null = null;
let currentScript: PodcastWorkspaceWithCompatibility | null = null;
const podcastBriefs = new Map<string, PodcastBrief>();
const podcastScripts = new Map<string, PodcastWorkspaceWithCompatibility>();

type OwnedPodcastFilterPreset = PodcastFilterPreset & { owner_id: string | null };
const podcastFilterPresets = new Map<string, OwnedPodcastFilterPreset>();
const podcastDevelopmentPlans = new Map<string, PodcastDevelopmentPlan>();
const podcastGroundedRuns = new Map<string, PodcastGroundedRun>();
const podcastAttestations = new Map<string, PodcastCuttingRoomAttestation & { raw_text?: string }>();
const podcastCutKeys = new Map<string, PodcastCutKey>();
const podcastAudioAssets = new Map<string, string>();
const podcastApprovalReceipts = new Map<string, { stage: "development" | "brief" | "script" | "audio"; reviewer: string; decided_at: string }>();
const podcastExecutionRecords = new Map<string, PodcastGroundedRun["agent_executions"][number]>();

const podcastStatePath = process.env.PODCAST_STATE_PATH ?? join(process.cwd(), ".podcast-room-state.json");
const audioDirectory = process.env.PODCAST_AUDIO_DIRECTORY ?? join(process.cwd(), ".podcast-audio");
type PodcastStorageHealth = "healthy" | "degraded";
let podcastStorageHealth: PodcastStorageHealth = "healthy";
let podcastPersistenceQueue: Promise<void> = Promise.resolve();
let podcastPersistenceRevision: number | null = null;
let podcastMutationLock: Promise<void> = Promise.resolve();
let podcastMutationActive = false;
let stagedPodcastState: PersistedPodcastState | null = null;
const podcastLockContext = new AsyncLocalStorage<PodcastMutationLock>();

export type PodcastMutationLock = {
  release: () => void;
  yieldForExternalWork: <T>(work: () => Promise<T>) => Promise<T>;
};

type PersistedPodcastState = {
  briefs: PodcastBrief[];
  scripts: PodcastWorkspaceWithCompatibility[];
  filterPresets?: OwnedPodcastFilterPreset[];
  developmentPlans?: PodcastDevelopmentPlan[];
  currentBriefId: string | null;
  currentScriptId: string | null;
  groundedRuns?: PodcastGroundedRun[];
  attestations?: (PodcastCuttingRoomAttestation & { raw_text?: string })[];
  cutKeys?: PodcastCutKey[];
  audioAssets?: { clipId: string; sha256: string }[];
  approvalReceipts?: { key: string; receipt: { stage: "development" | "brief" | "script" | "audio"; reviewer: string; decided_at: string } }[];
  executionRecords?: { key: string; execution: PodcastGroundedRun["agent_executions"][number] }[];
};

type LegacyPersistedReleaseKit = {
  id: string;
  script_id: string;
  status: PodcastReleaseKit["status"];
  titles: string[];
  episode_description: string;
  chapters: PodcastReleaseKit["chapters"];
  host_notes: string[];
  promotion_drafts: PodcastReleaseKit["promotion_copy"];
  accessibility_notes: string[];
  provenance_summary: string;
  audio_status: PodcastReleaseKit["audio_status"];
  publishing_status: PodcastReleaseKit["publishing_status"];
  next_reviewer: string;
};

type PersistedScript = Omit<PodcastWorkspaceWithCompatibility, "release_kit"> & {
  release_kit?: PodcastReleaseKit | LegacyPersistedReleaseKit | null;
};

type PersistedPodcastStateInput = Omit<PersistedPodcastState, "scripts"> & {
  scripts?: PersistedScript[];
};

export function getPodcastStorageHealth() {
  return { status: podcastStorageHealth } as const;
}

function serializedPodcastState(): PersistedPodcastState {
  return {
    briefs: [...podcastBriefs.values()],
    scripts: [...podcastScripts.values()],
    filterPresets: [...podcastFilterPresets.values()],
    developmentPlans: [...podcastDevelopmentPlans.values()],
    currentBriefId: currentBrief?.id ?? null,
    currentScriptId: currentScript?.id ?? null,
    groundedRuns: [...podcastGroundedRuns.values()],
    attestations: [...podcastAttestations.values()],
    cutKeys: [...podcastCutKeys.values()],
    audioAssets: [...podcastAudioAssets.entries()].map(([clipId, sha256]) => ({ clipId, sha256 })),
    approvalReceipts: [...podcastApprovalReceipts.entries()].map(([key, receipt]) => ({ key, receipt })),
    executionRecords: [...podcastExecutionRecords.entries()].map(([key, execution]) => ({ key, execution })),
  };
}

function enqueuePodcastPersistence(work: () => Promise<void>, operation: string, artifactType: string) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return;
  podcastPersistenceQueue = podcastPersistenceQueue
    .then(work)
    .then(
      () => {
        podcastStorageHealth = "healthy";
      },
      (error) => {
        podcastStorageHealth = "degraded";
        logger.error(
          { artifact_type: artifactType, operation, error: error instanceof Error ? error.message : String(error) },
          "Podcast durable persistence failed",
        );
        throw error;
      },
    );
  podcastPersistenceQueue.catch(() => undefined);
}

export async function flushPodcastPersistence() {
  if (podcastMutationActive && stagedPodcastState) {
    const state = stagedPodcastState;
    stagedPodcastState = null;
    enqueuePodcastPersistence(async () => {
      podcastPersistenceRevision = await savePodcastStateToDatabase(state, podcastPersistenceRevision);
    }, "commit", "podcast_request");
  }
  try {
    await podcastPersistenceQueue;
    return true;
  } catch {
    return false;
  }
}

async function acquirePodcastMutationLockRelease() {
  let release!: () => void;
  const previous = podcastMutationLock;
  podcastMutationLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  if (
    process.env.PODCAST_DURABILITY_DISABLED !== "true" &&
    !await preparePodcastPersistence()
  ) {
    release();
    throw new Error("Podcast persistence is unavailable.");
  }
  podcastMutationActive = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    podcastMutationActive = false;
    stagedPodcastState = null;
    release();
  };
}

export async function acquirePodcastMutationLock(): Promise<PodcastMutationLock> {
  let currentRelease = await acquirePodcastMutationLockRelease();
  let released = false;
  const lock: PodcastMutationLock = {
    release: () => {
      if (released) return;
      released = true;
      currentRelease();
    },
    yieldForExternalWork: async <T>(work: () => Promise<T>) => {
      if (released) throw new Error("Podcast mutation lock is no longer active.");
      if (stagedPodcastState) {
        throw new Error("Podcast state cannot yield after mutation staging has begun.");
      }
      const expectedRevision = podcastPersistenceRevision;
      currentRelease();
      let result: T | undefined;
      let workError: unknown;
      try {
        result = await work();
      } catch (error) {
        workError = error;
      }
      currentRelease = await acquirePodcastMutationLockRelease();
      if (podcastPersistenceRevision !== expectedRevision) {
        throw new Error("Podcast state changed while external work was running; retry the request.");
      }
      if (workError) throw workError;
      return result as T;
    },
  };
  return lock;
}

export function runWithPodcastMutationLock<T>(lock: PodcastMutationLock, work: () => T) {
  return podcastLockContext.run(lock, work);
}

async function yieldPodcastMutationLock<T>(work: () => Promise<T>) {
  const lock = podcastLockContext.getStore();
  return lock ? lock.yieldForExternalWork(work) : work();
}

export async function refreshPodcastPersistence() {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return;
  const stored = await loadPodcastStateFromDatabase();
  if (!stored) return;
  if (!rehydratePodcastState(stored.state)) throw new Error("Stored podcast state is invalid.");
  podcastPersistenceRevision = stored.revision;
}

async function preparePodcastPersistence() {
  if (!await flushPodcastPersistence()) {
    podcastPersistenceQueue = Promise.resolve();
    podcastStorageHealth = "degraded";
  }
  try {
    await refreshPodcastPersistence();
    return true;
  } catch (error) {
    podcastStorageHealth = "degraded";
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Podcast state refresh failed");
    return false;
  }
}

function persistPodcastState(operation: string, artifactType: string) {
  const temporaryPath = `${podcastStatePath}.tmp`;
  const state = serializedPodcastState();
  if (podcastMutationActive) {
    stagedPodcastState = state;
  } else {
    enqueuePodcastPersistence(async () => {
      podcastPersistenceRevision = await savePodcastStateToDatabase(state, podcastPersistenceRevision);
    }, operation, artifactType);
  }
  try {
    writeFileSync(
      temporaryPath,
      JSON.stringify(state),
      "utf8",
    );
    renameSync(temporaryPath, podcastStatePath);
    return true;
  } catch (error) {
    logger.warn(
      {
        artifact_type: artifactType,
        operation,
        error: error instanceof Error ? error.message : String(error),
      },
      "Podcast workspace compatibility mirror failed",
    );
    try {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    } catch {
      // The original persistence error is the actionable failure.
    }
    return true;
  }
}

/**
 * Restore the complete podcast workspace repository on process startup.
 * The status checks in the read/create functions remain the authorization
 * boundary, so persisted drafts and rejected artifacts cannot be opened.
 */
export function restorePodcastState() {
  if (!existsSync(podcastStatePath)) return;
  try {
    if (!rehydratePodcastState(JSON.parse(readFileSync(podcastStatePath, "utf8")))) {
      podcastStorageHealth = "degraded";
    }
  } catch (error) {
    podcastStorageHealth = "degraded";
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, "Podcast workspace restoration failed");
  }
}

export async function initializePodcastPersistence() {
  try {
    let importedLocalState = false;
    const databaseState = await loadPodcastStateFromDatabase();
    if (databaseState) {
      if (!rehydratePodcastState(databaseState.state)) {
        podcastStorageHealth = "degraded";
        throw new Error("Stored podcast state is invalid.");
      }
      podcastPersistenceRevision = databaseState.revision;
    } else if (existsSync(podcastStatePath)) {
      restorePodcastState();
      if (podcastStorageHealth === "degraded") {
        throw new Error("The local podcast state could not be imported safely.");
      }
      importedLocalState = true;
    }
    const discoveredLegacyAudio = await migratePersistedPodcastAudio();
    if (importedLocalState || discoveredLegacyAudio) {
      const importedState = serializedPodcastState();
      try {
        podcastPersistenceRevision = await savePodcastStateToDatabase(
          importedState,
          podcastPersistenceRevision,
        );
      } catch (error) {
        const winningState = await loadPodcastStateFromDatabase();
        if (
          !winningState ||
          !persistedPodcastStateRetainsImport(importedState, winningState.state) ||
          !rehydratePodcastState(winningState.state)
        ) {
          throw error;
        }
        podcastPersistenceRevision = winningState.revision;
        await migratePersistedPodcastAudio();
        logger.info(
          { revision: winningState.revision },
          "Podcast startup converged on a concurrent durable import",
        );
      }
    }
    podcastStorageHealth = "healthy";
  } catch (error) {
    podcastStorageHealth = "degraded";
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, "Podcast durable persistence initialization failed");
    throw error;
  }
}

function persistedPodcastStateRetainsImport(expected: PersistedPodcastState, candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return false;
  const actual = candidate as Partial<PersistedPodcastState>;
  const retainsIds = <T>(
    expectedItems: T[] | undefined,
    actualItems: T[] | undefined,
    identity: (item: T) => string,
  ) => {
    const actualIds = new Set((actualItems ?? []).map(identity));
    return (expectedItems ?? []).every((item) => actualIds.has(identity(item)));
  };
  return (
    retainsIds(expected.briefs, actual.briefs, (item) => item.id) &&
    retainsIds(expected.scripts, actual.scripts, (item) => item.id) &&
    retainsIds(expected.filterPresets, actual.filterPresets, (item) => item.id) &&
    retainsIds(expected.developmentPlans, actual.developmentPlans, (item) => item.id) &&
    retainsIds(expected.groundedRuns, actual.groundedRuns, (item) => item.id) &&
    retainsIds(expected.attestations, actual.attestations, (item) => item.id) &&
    retainsIds(expected.cutKeys, actual.cutKeys, (item) => `${item.key}:${item.audio_sha256}`) &&
    retainsIds(expected.audioAssets, actual.audioAssets, (item) => `${item.clipId}:${item.sha256}`) &&
    retainsIds(expected.approvalReceipts, actual.approvalReceipts, (item) => item.key) &&
    retainsIds(expected.executionRecords, actual.executionRecords, (item) => item.key)
  );
}

async function migratePersistedPodcastAudio() {
  let discoveredLegacyAudio = false;
  for (const script of podcastScripts.values()) {
    const clipId = script.audio_clip?.id;
    if (!clipId) continue;
    const manifest = [...podcastCutKeys.values()].find(
      (candidate) => candidate.clip_id === clipId && candidate.superseded_by === null,
    );
    let expectedSha256 = manifest?.audio_sha256 ?? podcastAudioAssets.get(clipId);
    const localPath = join(audioDirectory, `${clipId}.wav`);
    if (!expectedSha256 && existsSync(localPath)) {
      expectedSha256 = createHash("sha256").update(readFileSync(localPath)).digest("hex");
      podcastAudioAssets.set(clipId, expectedSha256);
      discoveredLegacyAudio = true;
    }
    if (!expectedSha256) continue;
    const available = await migrateLocalPodcastAudio(
      clipId,
      localPath,
      expectedSha256,
    );
    if (!available) throw new Error(`Durable podcast audio is missing for ${clipId}`);
  }
  return discoveredLegacyAudio;
}

function normalizePersistedReleaseKit(
  releaseKit: PodcastReleaseKit | LegacyPersistedReleaseKit | null | undefined,
): PodcastReleaseKit | null {
  if (!releaseKit || typeof releaseKit !== "object") return null;
  const candidate = releaseKit as PodcastReleaseKit & {
    titles?: string[];
    promotion_drafts?: PodcastReleaseKit["promotion_copy"];
  };
  return {
    ...candidate,
    title_options: candidate.title_options ?? candidate.titles ?? [],
    promotion_copy: candidate.promotion_copy ?? candidate.promotion_drafts ?? [],
    audio_status: candidate.audio_status === ("blocked_until_final_approval" as PodcastReleaseKit["audio_status"])
      ? "awaiting_audio_approval"
      : candidate.audio_status,
  };
}

function normalizeGroundingSource(
  source: PodcastGroundingSource,
  fallbackPolicyReference: string,
): PodcastGroundingSource {
  const uncertainty = source.what_remains_uncertain?.trim()
    || "The available source does not settle identity, intent, representativeness, or platform-wide opinion.";
  return {
    ...source,
    source_identifier: source.source_identifier
      ?? createHash("sha256").update(source.url).digest("hex").slice(0, 16),
    consent_reference: source.consent_reference ?? null,
    policy_reference: source.policy_reference ?? fallbackPolicyReference,
    aggregate_summary: source.aggregate_summary
      ?? (fallbackPolicyReference === "legacy-unverified-provenance"
        ? "Legacy citation; aggregate-only handling was not recorded."
        : "Topic-level source metadata only; no identity or copied comment text is retained."),
    evidence_gaps: source.evidence_gaps?.length ? source.evidence_gaps : [uncertainty],
  };
}

function normalizeGroundedRun(run: PodcastGroundedRun): PodcastGroundedRun {
  let provider = run.provider ?? "legacy_unverified";
  let policyReference = run.policy_reference
    ?? (provider === "synthetic_fixture" ? "synthetic-fixture-policy-v1" : "legacy-unverified-provenance");
  if (provider === "google_public_web" && policyReference === currentContextPolicyReference) {
    try {
      strictPodcastEvidenceConcept(run.concept, run.sources.map((source) => source.title));
    } catch {
      provider = "legacy_unverified";
      policyReference = "legacy-unverified-provenance";
    }
  }
  return {
    ...run,
    provider,
    window: run.window ?? "not_recorded",
    policy_reference: policyReference,
    sources: run.sources.map((source, index) => {
      const normalized = normalizeGroundingSource(source, policyReference);
      return provider === "google_public_web"
        ? { ...normalized, title: `Approved public-web result ${index + 1}`, snippet: "" }
        : normalized;
    }),
  };
}

function normalizeCutKeyGroundingSources(cutKey: PodcastCutKey): PodcastCutKey {
  return {
    ...cutKey,
    citations: cutKey.citations.map((source, index) => {
      const normalized = normalizeGroundingSource(source, "legacy-unverified-provenance");
      return normalized.policy_reference === currentContextPolicyReference
        ? { ...normalized, title: `Approved public-web citation ${index + 1}`, snippet: "" }
        : normalized;
    }),
  };
}

function groundedRunRoomSources(run: PodcastGroundedRun): PodcastSource[] {
  const accessMode = run.provider === "google_public_web" && run.policy_reference === currentContextPolicyReference
    ? "approved_live" as const
    : run.provider === "synthetic_fixture"
      ? "fixture" as const
      : "public_url" as const;
  return run.sources.map((source) => ({
    id: source.id, source_url: source.url, platform: "Public web", community: new URL(source.url).hostname,
    post_title: source.title, timestamp: source.retrieved_at, retrieved_at: source.retrieved_at,
    engagement: { score: 0, comments: 0 }, source_id: source.source_identifier, access_mode: accessMode,
    source_class: source.source_type, evidence_type: source.classification,
    consent_reference: source.consent_reference,
    policy_reference: source.policy_reference,
    evidence_gaps: source.evidence_gaps,
  }));
}

function rehydrateActiveGroundedIndexes() {
  activeGroundedSources.splice(0);
  activeGroundedConcepts.splice(0);
  // Runs are persisted in insertion order; the newest run remains the room's active run.
  const run = [...podcastGroundedRuns.values()]
    .filter((candidate) => syntheticDemoEnabled() || candidate.runtime_status === "Live Gemini")
    .at(-1);
  if (!run) return;
  activeGroundedSources.push(...groundedRunRoomSources(run));
  activeGroundedConcepts.push(run.concept);
}

export function runForPodcastArtifact(conceptId: string, sourceIds: string[]) {
  return [...podcastGroundedRuns.values()].reverse().find((run) =>
    (syntheticDemoEnabled() || run.runtime_status === "Live Gemini") &&
    run.concept.id === conceptId &&
    sourceIds.length === run.sources.length &&
    sourceIds.every((id) => run.sources.some((source) => source.id === id)),
  ) ?? null;
}

/**
 * Rehydrate both the current storage format and the previous release-kit format.
 * Keeping this boundary separate from file I/O lets compatibility fixtures test
 * upgrades without replacing the workspace's real state file.
 */
export function rehydratePodcastState(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const saved = input as PersistedPodcastStateInput;
  if (!Array.isArray(saved.briefs) || !Array.isArray(saved.scripts)) return false;

  try {
    currentBrief = null;
    currentScript = null;
    podcastBriefs.clear();
    podcastScripts.clear();
    podcastFilterPresets.clear();
    podcastDevelopmentPlans.clear();
    podcastGroundedRuns.clear();
    podcastAttestations.clear();
    podcastCutKeys.clear();
    podcastAudioAssets.clear();
    podcastApprovalReceipts.clear();
    podcastExecutionRecords.clear();
    for (const brief of saved.briefs ?? []) {
      if (brief?.id) podcastBriefs.set(brief.id, brief);
    }
    for (const script of saved.scripts) {
      if (script?.id) {
        const releaseKit = script.release_kit;
        const requiredCompatibilityNormalization =
          Boolean(releaseKit && typeof releaseKit === "object" && ("titles" in releaseKit || "promotion_drafts" in releaseKit));
        podcastScripts.set(script.id, {
          ...script,
          workspace_revision: script.workspace_revision ?? randomUUID(),
          compatibility_normalized: requiredCompatibilityNormalization,
          release_kit: normalizePersistedReleaseKit(releaseKit),
        });
      }
    }
    for (const preset of saved.filterPresets ?? []) {
      if (preset?.id) {
        podcastFilterPresets.set(preset.id, {
          ...preset,
          owner_id: typeof preset.owner_id === "string" ? preset.owner_id : null,
        });
      }
    }
    for (const plan of saved.developmentPlans ?? []) {
      if (plan?.id) podcastDevelopmentPlans.set(plan.id, plan);
    }
    for (const run of saved.groundedRuns ?? []) {
      if (run?.id) podcastGroundedRuns.set(run.id, normalizeGroundedRun(run));
    }
    for (const attestation of saved.attestations ?? []) {
      if (attestation?.id && attestation.run_id) {
        podcastAttestations.set(attestation.run_id, attestation);
      }
    }
    for (const cutKey of saved.cutKeys ?? []) {
      if (!cutKey?.key) continue;
      const persisted = cutKey as PodcastCutKey & { superseded_by?: string | null };
      const legacySuperseded = typeof persisted.supersedes === "string" && persisted.supersedes.startsWith("superseded-by-");
      podcastCutKeys.set(persisted.key, normalizeCutKeyGroundingSources({
        ...persisted,
        run_id: persisted.run_id ?? null,
        attestation_id: persisted.attestation_id ?? null,
        supersedes: legacySuperseded ? null : persisted.supersedes ?? null,
        superseded_by: persisted.superseded_by ?? (legacySuperseded ? persisted.supersedes : null),
      }));
    }
    for (const asset of saved.audioAssets ?? []) {
      if (asset?.clipId && /^[a-f0-9]{64}$/.test(asset.sha256)) {
        podcastAudioAssets.set(asset.clipId, asset.sha256);
      }
    }
    for (const item of saved.approvalReceipts ?? []) if (item?.key && item.receipt) podcastApprovalReceipts.set(item.key, item.receipt);
    for (const item of saved.executionRecords ?? []) if (item?.key && item.execution) podcastExecutionRecords.set(item.key, item.execution);
    rehydrateActiveGroundedIndexes();
    currentBrief = saved.currentBriefId ? podcastBriefs.get(saved.currentBriefId) ?? null : null;
    for (const script of podcastScripts.values()) {
      const brief = podcastBriefs.get(script.brief_id);
      if (brief && !podcastWorkspaceMatchesBrief(script, brief)) {
        discardPodcastWorkspace(script);
      }
    }
    currentScript = saved.currentScriptId ? podcastScripts.get(saved.currentScriptId) ?? null : null;
    podcastStorageHealth = "healthy";
    return true;
  } catch (error) {
    currentBrief = null;
    currentScript = null;
    podcastBriefs.clear();
    podcastScripts.clear();
    podcastFilterPresets.clear();
    podcastDevelopmentPlans.clear();
    podcastGroundedRuns.clear();
    podcastAttestations.clear();
    podcastCutKeys.clear();
    podcastAudioAssets.clear();
    podcastApprovalReceipts.clear();
    podcastExecutionRecords.clear();
    activeGroundedSources.splice(0);
    activeGroundedConcepts.splice(0);
    podcastStorageHealth = "degraded";
    console.error("Podcast workspace rehydration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

restorePodcastState();

type GeneratedPodcastDraft = Pick<
  PodcastBrief,
  | "topic_angle"
  | "audience_pain"
  | "why_now"
  | "key_tensions"
  | "risk_notes"
  | "episode_outline"
  | "suggested_title"
>;

function fixtureBrief(conceptId: string, sourceIds: string[]): PodcastBrief {
  return {
    id: `brief-${conceptId}`,
    concept_id: conceptId,
    selected_source_ids: sourceIds,
    run_id: null,
    attestation_id: null,
    status: "draft" as const,
    generated_mode: "synthetic_demo" as const,
    topic_angle:
      "The smartest recap is not a verdict on the cast. It is a reconstruction of what the edit makes visible, what it compresses, and what the audience is still trying to place.",
    audience_pain:
      "Viewers feel that the emotional stakes are obvious but the timeline is not. They want context without being pushed toward a pile-on.",
    why_now:
      `The same question is appearing across ${new Set(allPodcastSources().filter((source) => sourceIds.includes(source.id)).map((source) => source.community)).size} public communities within the current episode window, with high discussion velocity and a clear shift from reaction to context-seeking.`,
    key_tensions: [
      "Narrative clarity versus editorial compression",
      "A satisfying explanation versus unsupported certainty",
      "Audience curiosity versus targeting an individual",
    ],
    source_links: allPodcastSources().filter((source) => sourceIds.includes(source.id)).map((source) => ({
      source_id: source.id,
      url: source.source_url,
      label: `${source.community} · ${source.post_title}`,
      retrieved_at: source.retrieved_at,
    })),
    risk_notes: [
      "Do not quote comments verbatim or imply that a Reddit discussion represents the whole audience.",
      "Do not identify or speculate about a real person. Keep the analysis at edit, format, and audience-pattern level.",
      "Any script or audio rendering remains blocked until a human approves this brief.",
    ],
    episode_outline: [
      { segment: "Cold open", purpose: "Start with the audience's shared question: what did the edit ask us to assume?" },
      { segment: "The reconstruction", purpose: "Lay out the public-source pattern and distinguish repetition from independent concern." },
      { segment: "The editorial tension", purpose: "Explore why compression can create a strong feeling without a complete timeline." },
      { segment: "What a better recap does", purpose: "Offer a source-backed, non-targeting format for explaining uncertainty." },
      { segment: "Close", purpose: "Leave listeners with a question to watch for in the next cut." },
    ],
    suggested_title: "The Scene Between the Scenes",
    approval_note: "Draft only. Human approval is required before any script or audio rendering.",
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function containsUnsafeCurrentContextText(
  value: string,
  forbiddenSourceTitles: string[],
  forbiddenIdentities: string[] = [],
) {
  const normalized = value.toLowerCase();
  return /[@“”"]|\b(?:u|r)\/[a-z0-9_-]+|https?:\/\//i.test(value)
    || forbiddenIdentities.some((identity) => normalized.includes(identity.toLowerCase()))
    || forbiddenSourceTitles.some((title) => {
      const normalizedTitle = title.trim().toLowerCase();
      return normalizedTitle.length > 20 && normalized.includes(normalizedTitle);
    });
}

export function strictPodcastEvidenceConcept(
  input: unknown,
  forbiddenSourceTitles: string[] = [],
  forbiddenIdentities: string[] = [],
) {
  const parsed = input as Partial<PodcastConcept>;
  const returnedText = [
    parsed.title,
    parsed.summary,
    parsed.observed_signal,
    parsed.supported_context,
    ...(Array.isArray(parsed.unresolved_questions) ? parsed.unresolved_questions : []),
  ].filter(nonEmptyString);
  const containsUnsafeProviderText = returnedText.some((value) =>
    containsUnsafeCurrentContextText(value, forbiddenSourceTitles, forbiddenIdentities));
  if (
    !nonEmptyString(parsed.title) ||
    !nonEmptyString(parsed.summary) ||
    !nonEmptyString(parsed.observed_signal) ||
    !nonEmptyString(parsed.supported_context) ||
    !Array.isArray(parsed.unresolved_questions) ||
    parsed.unresolved_questions.length === 0 ||
    !parsed.unresolved_questions.every(nonEmptyString) ||
    containsUnsafeProviderText
  ) {
    throw new Error("Evidence editor returned malformed structured output.");
  }
  return {
    title: parsed.title,
    summary: parsed.summary,
    observed_signal: parsed.observed_signal,
    supported_context: parsed.supported_context,
    unresolved_questions: parsed.unresolved_questions,
  };
}

function containsSourceText(value: string, sources: PodcastSource[]) {
  const normalized = value.trim().toLowerCase();
  return sources.some((source) => {
    const title = source.post_title.trim().toLowerCase();
    return title.length > 20 && normalized.includes(title);
  });
}

/**
 * Keep model output at summary level. A malformed response or text that repeats
 * source material is rejected field-by-field, leaving the known-safe fixture.
 */
export function buildSafePodcastDraft(
  parsed: unknown,
  fallback: GeneratedPodcastDraft,
  sources: PodcastSource[],
): GeneratedPodcastDraft {
  const candidate = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const safeText = (value: unknown, fallbackValue: string) =>
    nonEmptyString(value) && !containsSourceText(value, sources) ? value : fallbackValue;
  const safeStringArray = (value: unknown, fallbackValue: string[]) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => nonEmptyString(item) && !containsSourceText(item, sources))
      ? value
      : fallbackValue;
  const safeOutline = (value: unknown) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        nonEmptyString((item as { segment?: unknown }).segment) &&
        nonEmptyString((item as { purpose?: unknown }).purpose) &&
        !containsSourceText((item as { segment: string }).segment, sources) &&
        !containsSourceText((item as { purpose: string }).purpose, sources),
    )
      ? value as PodcastBrief["episode_outline"]
      : fallback.episode_outline;

  return {
    topic_angle: safeText(candidate.topic_angle, fallback.topic_angle),
    audience_pain: safeText(candidate.audience_pain, fallback.audience_pain),
    why_now: safeText(candidate.why_now, fallback.why_now),
    key_tensions: safeStringArray(candidate.key_tensions, fallback.key_tensions),
    risk_notes: safeStringArray(candidate.risk_notes, fallback.risk_notes),
    episode_outline: safeOutline(candidate.episode_outline),
    suggested_title: safeText(candidate.suggested_title, fallback.suggested_title),
  };
}

function buildPodcastRoom(presetVisible: (preset: OwnedPodcastFilterPreset) => boolean) {
  const selectedBriefId = currentBrief?.id ?? null;
  const selectedScriptId =
    currentScript && currentScript.brief_id === selectedBriefId ? currentScript.id : null;
  return {
    sources: allPodcastSources(),
    concepts: allPodcastConcepts(),
    filter_presets: [...podcastFilterPresets.values()].filter(presetVisible),
    data_notice:
      "Public-source path only · summaries are pattern-level · comments are never copied verbatim · provenance is retained per item.",
    rendering_status: "blocked_until_approval" as const,
    selected_brief_id: selectedBriefId,
    decision_history: getPodcastDecisionHistory({
      briefId: selectedBriefId,
      scriptId: selectedScriptId,
    }),
  };
}
export function getPodcastRoom(producerId: string) {
  return buildPodcastRoom(
    (preset) => preset.owner_id === null || preset.owner_id === producerId,
  );
}

export function getUnscopedPodcastRoom() {
  return buildPodcastRoom(() => true);
}
export function getPodcastLiveSnapshot(): PodcastLiveSnapshot {
  const live = getLiveObservationSnapshot();
  const refreshedAt = now();
  if (live) {
    const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(live.received_at).getTime()) / 60_000));
    return {
      source_mode: "approved_live",
      source_status: "active · approved consented source",
      source_id: live.source_id,
      source_class: live.source_class,
      consent_reference: live.consent_ref,
      policy_review_reference: live.policy_review_ref,
      freshness: `${ageMinutes}m since receipt`,
      refreshed_at: refreshedAt,
      observation_window: live.observation_window,
      aggregate_observations: live.observation_count,
      signal_label: "live observation · aggregate-only",
      data_notice: "Approved live newsroom observations are grouped and de-amplified. Identity fields and raw comments are not available to the Podcast Room.",
    };
  }
  const starts = podcastSources.map((source) => source.timestamp).sort()[0] ?? refreshedAt;
  const ends = podcastSources.map((source) => source.retrieved_at).sort().at(-1) ?? refreshedAt;
  return {
    source_mode: "synthetic_fixture",
    source_status: "fixture fallback · no approved live batch available",
    source_id: "podcast-curated-fixture-v1",
    source_class: "synthetic_entertainment_index",
    consent_reference: null,
    policy_review_reference: null,
    freshness: "fixed demonstration window",
    refreshed_at: refreshedAt,
    observation_window: { start: starts, end: ends },
    aggregate_observations: podcastSources.length,
    signal_label: "synthetic fixture · not a live audience measurement",
    data_notice: "This fallback is synthetic and curated. It does not represent current public opinion, platform-wide behavior, or a popularity forecast.",
  };
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function methodologyFactors(
  concept: PodcastConcept,
  sourceIds: string[],
  format: PodcastFormatVariant["format"],
) {
  const selectedSources = allPodcastSources().filter((source) => sourceIds.includes(source.id));
  const retrieved = selectedSources.filter((source) => source.access_mode !== "manual_url").length;
  const sourceClasses = new Set(selectedSources.map((source) => source.source_class ?? source.platform));
  const formatBoost: Record<PodcastFormatVariant["format"], { clarity: number; pacing: number; title: number }> = {
    cold_open_explainer: { clarity: 86, pacing: 91, title: 88 },
    reported_explainer: { clarity: 93, pacing: 76, title: 81 },
    structured_debate: { clarity: 78, pacing: 87, title: 84 },
    context_recap: { clarity: 89, pacing: 82, title: 79 },
    listener_question: { clarity: 84, pacing: 88, title: 86 },
  };
  const boost = formatBoost[format];
  return [
    { id: "audience-fit", label: "Audience fit", score: percent(concept.relevance), evidence: `${concept.confidence_label}; tailored to the selected audience and use case.`, uncertainty: "Fit is an editorial hypothesis until a controlled listening test is run." },
    { id: "clarity", label: "Narrative clarity", score: boost.clarity, evidence: "The segment spine separates observation, supported context, interpretation, and unresolved questions.", uncertainty: "A script read-through is still needed to test comprehension." },
    { id: "novelty", label: "Novelty", score: Math.round((percent(concept.relevance) + percent(concept.source_diversity)) / 2), evidence: `${sourceClasses.size} source classes support a format-level angle beyond raw reaction.`, uncertainty: "Novelty is relative to this bounded source set, not the whole market." },
    { id: "tension", label: "Constructive tension", score: percent((concept.urgency + concept.engagement) / 2), evidence: concept.unresolved_questions[0] ?? "An unresolved editorial question remains visible.", uncertainty: "Tension must not be converted into unsupported certainty or targeting." },
    { id: "source-diversity", label: "Source diversity", score: Math.min(100, Math.round((sourceClasses.size / Math.max(1, selectedSources.length)) * 100)), evidence: `${sourceClasses.size} distinct source classes across ${selectedSources.length} selected sources.`, uncertainty: `${retrieved} of ${selectedSources.length} selected sources are retrieval-complete.` },
    { id: "freshness", label: "Freshness", score: percent(concept.freshness), evidence: concept.freshness_label, uncertainty: "Freshness describes the recorded observation window, not continuing audience momentum." },
    { id: "pacing", label: "Pacing hypothesis", score: boost.pacing, evidence: "The proposed sequence alternates evidence, interpretation, and an open question.", uncertainty: "Pacing requires a timed table read or audio preview." },
    { id: "title-promise", label: "Title promise", score: boost.title, evidence: "The title states a specific editorial question the cited segment spine can answer.", uncertainty: "Click and completion behavior cannot be inferred from a title alone." },
  ];
}

function makeVariant(
  concept: PodcastConcept,
  sourceIds: string[],
  format: PodcastFormatVariant["format"],
  title: string,
  premise: string,
  openingBeat: string,
  tradeoff: string,
): PodcastFormatVariant {
  const factors = methodologyFactors(concept, sourceIds, format);
  return {
    id: `${format}-${concept.id}`,
    title,
    format,
    premise,
    opening_beat: openingBeat,
    segment_spine: [
      { label: "Open", purpose: openingBeat, source_ids: sourceIds },
      { label: "Evidence turn", purpose: concept.supported_context, source_ids: sourceIds },
      { label: "Unresolved turn", purpose: concept.unresolved_questions[0] ?? "Name what the available evidence cannot resolve.", source_ids: sourceIds },
      { label: "Close", purpose: "Offer one answerable next question and state the limits of the forecast.", source_ids: sourceIds },
    ],
    citation_ids: sourceIds,
    methodology_factors: factors,
    hypotheses: [
      { metric: "listen-through", statement: "A clear evidence turn may reduce early confusion and improve completion in a controlled comparison.", validation_method: "Compare aggregate 25%, 50%, and 90% completion across matched pilot variants." },
      { metric: "subscription intent", statement: "A repeatable source-backed format may increase stated intent to hear the next episode.", validation_method: "Use an aggregate post-listen intent question; do not identify or retarget respondents." },
    ],
    risks: [
      "A strong premise can overstate a directional signal if the uncertainty language is removed.",
      "Forecast factors are hypotheses, not promises of popularity, conversion, or platform ranking.",
    ],
    tradeoff,
    forecast_label: "Testable editorial hypothesis · not a popularity guarantee",
  };
}

export function createPodcastDevelopment(
  conceptId: string,
  requestedSourceIds: string[],
  audience: string,
  useCase: string,
) {
  const concept = allPodcastConcepts().find((item) => item.id === conceptId);
  if (!concept) {
    if (!syntheticDemoEnabled()) throw new Error("No exact grounded concept is available for production brief generation.");
    return null;
  }
  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  if (!sourceIds.length) return null;
  const snapshot = getPodcastLiveSnapshot();
  const variants = [
    makeVariant(concept, sourceIds, "cold_open_explainer", "The question before the answer", "Lead with the missing piece, then earn the explanation through cited context.", "Open on the shared question, then reveal which part the evidence can actually answer.", "Fastest hook, but the opening must not imply the unresolved point is already proven."),
    makeVariant(concept, sourceIds, "reported_explainer", "What the record can support", "Build a compact reported explainer around chronology, source classes, and the limits of the available record.", "Begin with two facts from different source classes and the gap between them.", "Highest clarity, with less room for spontaneous host chemistry."),
    makeVariant(concept, sourceIds, "structured_debate", "Certainty versus context", "Stage the strongest responsible interpretations against the evidence boundary without manufacturing conflict.", "State two plausible format readings, then disclose what neither can prove.", "Creates tension, but requires disciplined moderation to avoid false equivalence."),
    makeVariant(concept, sourceIds, "context_recap", "The scene between the scenes", "Recap the episode through editorial choices and audience questions rather than a verdict about a person.", "Start at the edit point that made chronology difficult to follow.", "Familiar and accessible, but can feel conventional without a sharp evidence turn."),
    makeVariant(concept, sourceIds, "listener_question", "The question the cut leaves open", "Use a grouped, answerable audience question as the recurring structure for a concise episode.", "Ask the safest unresolved question and explain why it is answerable only in part.", "Inviting and repeatable, but must not imply a small observed group represents all listeners."),
  ];
  const factorScores = Object.fromEntries(
    variants[0].methodology_factors.map((factor) => [factor.id, factor.score]),
  );
  const id = `development-${concept.id}-${Date.now()}`;
  const plan: PodcastDevelopmentPlan = {
    id,
    concept_id: concept.id,
    source_ids: sourceIds,
    audience,
    use_case: useCase,
    source_snapshot: snapshot,
    archetypes: podcastArchetypes,
    format_variants: variants,
    methodology_note: "Scores expose the evidence and assumptions behind each editorial hypothesis. They rank neither people nor public opinion and cannot guarantee popularity, retention, subscriptions, revenue, or platform placement.",
    measurement_record: {
      id: `measurement-${id}`,
      recorded_at: now(),
      concept_id: concept.id,
      source_ids: sourceIds,
      source_mode: snapshot.source_mode,
      archetype_id: null,
      format_id: null,
      factor_scores: factorScores,
      validation_status: "pending",
      validation_note: "Awaiting a human format decision. Future validation must use aggregate listening or approved outcome data.",
    },
    status: "draft",
    selected_archetype_id: null,
    selected_format_id: null,
    decision_note: "Draft only. A human producer must select and validate one fictional editorial lens and one format before brief generation.",
  };
  podcastDevelopmentPlans.set(id, plan);
  persistPodcastState("create", "podcast_development");
  recordAgentStage("PODCAST-DEVELOPMENT", "draft", concept.title, `${variants.length} cited variants · ${snapshot.source_mode}`);
  return plan;
}

export function recordPodcastDevelopmentValidation(
  id: string,
  decision: "validate" | "reject",
  archetypeId: string,
  formatId: string,
  reviewer: string,
) {
  const plan = podcastDevelopmentPlans.get(id);
  if (!plan) return null;
  const archetype = plan.archetypes.find((item) => item.id === archetypeId);
  const format = plan.format_variants.find((item) => item.id === formatId);
  if (!archetype || !format) return null;
  const status = decision === "validate" ? "validated" as const : "rejected" as const;
  const updated: PodcastDevelopmentPlan = {
    ...plan,
    status,
    selected_archetype_id: archetype.id,
    selected_format_id: format.id,
    decision_note: decision === "validate"
      ? "Validated by a human producer as a development hypothesis. Brief, script, release, audio, and publishing gates remain separate."
      : "Rejected by a human producer. No brief may be generated from this plan.",
    measurement_record: {
      ...plan.measurement_record,
      archetype_id: archetype.id,
      format_id: format.id,
      factor_scores: Object.fromEntries(format.methodology_factors.map((factor) => [factor.id, factor.score])),
      validation_status: status,
      validation_note: decision === "validate"
        ? "Human-selected hypothesis recorded for controlled listening validation."
        : "Human rejected this hypothesis before brief generation.",
    },
  };
  podcastDevelopmentPlans.set(id, updated);
  if (!persistPodcastState("decision", "podcast_development")) {
    podcastDevelopmentPlans.set(id, plan);
    return false;
  }
  recordHumanDecision("development", id, decision, reviewer);
  return updated;
}

export function getPodcastDevelopmentPlan(id: string) {
  return podcastDevelopmentPlans.get(id) ?? null;
}

export function isPodcastDevelopmentReady(id: string, conceptId: string, sourceIds: string[]) {
  const plan = podcastDevelopmentPlans.get(id);
  if (
    !plan ||
    plan.status !== "validated" ||
    !plan.selected_archetype_id ||
    !plan.selected_format_id ||
    plan.concept_id !== conceptId
  ) return false;
  const planned = [...new Set(plan.source_ids)].sort();
  const requested = [...new Set(sourceIds)].sort();
  return planned.length === requested.length && planned.every((sourceId, index) => sourceId === requested[index]);
}

export function createPodcastFilterPreset(
  name: string,
  platforms: string[],
  communities: string[],
  producerId?: string,
) {
  const preset: OwnedPodcastFilterPreset = {
    id: `preset-${randomUUID()}`,
    name: name.trim(),
    owner_id: producerId ?? null,
    platforms: [...new Set(platforms)],
    communities: [...new Set(communities)],
  };
  podcastFilterPresets.set(preset.id, preset);
  persistPodcastState("create", "filter_preset");
  return preset;
}

export function renamePodcastFilterPreset(id: string, name: string, producerId?: string) {
  const preset = podcastFilterPresets.get(id);
  if (!preset || (producerId !== undefined && preset.owner_id !== producerId)) return null;
  const renamed = { ...preset, name: name.trim() };
  podcastFilterPresets.set(id, renamed);
  persistPodcastState("rename", "filter_preset");
  return renamed;
}

export function deletePodcastFilterPreset(id: string, producerId?: string) {
  const preset = podcastFilterPresets.get(id);
  if (!preset || (producerId !== undefined && preset.owner_id !== producerId)) return false;
  if (!podcastFilterPresets.delete(id)) return false;
  persistPodcastState("delete", "filter_preset");
  return true;
}

function performedFormatOpening(brief: PodcastBrief) {
  return {
    cold_open_explainer: "Everybody saw the same cut. Somehow, everybody walked away with a different missing scene.",
    reported_explainer: "Two facts can sit next to each other and still leave a hole big enough for the whole internet to fall through.",
    structured_debate: "One reading says the edit clarified the story. Another says it created the mystery.",
    context_recap: "The most important scene in this episode may be the one we never actually saw.",
    listener_question: "A listener asked the question this entire conversation keeps circling: what, exactly, are we being asked to assume?",
  }[brief.selected_format?.format ?? "cold_open_explainer"]
    ?? "Everybody saw the same cut. Somehow, everybody walked away with a different missing scene.";
}

function performedArchetypePerspective(brief: PodcastBrief) {
  return {
    "investigative-decoder": "The timeline gives us a trail, but not permission to turn every gap into a conclusion.",
    "warm-interviewer": "There is a humane version of this conversation—one that leaves room for an answer without cornering a person.",
    "culture-critic": "This is bigger than one recap; it is about the way entertainment edits train us to mistake compression for certainty.",
    "comic-improviser": "Reality television can fit three weeks into forty-two minutes, which is efficient storytelling and absolutely terrible calendar management.",
  }[brief.editorial_archetype?.id ?? "investigative-decoder"]
    ?? "The timeline gives us a trail, but not permission to turn every gap into a conclusion.";
}

function fixtureScript(brief: PodcastBrief): PodcastWorkspaceWithCompatibility {
  const sourceIds = brief.source_links.map((link) => link.source_id);
  const tension = brief.key_tensions[0] ?? "The loudest version of the story is not necessarily the best-supported one.";
  const secondTension = brief.key_tensions[1] ?? "What remains unknown matters as much as what the source trail can confirm.";
  const formatOpening = performedFormatOpening(brief);
  const archetypePerspective = performedArchetypePerspective(brief);
  const spokenSections = [
    {
      segment: "cold_open",
      script: `${formatOpening} Here is the strange thing about ${brief.topic_angle.toLowerCase()}: the moment everyone thinks they know what happened is usually the moment the missing context starts doing the most work.`,
    },
    {
      segment: "banter",
      script: `${brief.why_now} That does not make the conversation true by volume. It makes it worth examining—carefully, and with the receipts still attached.`,
    },
    {
      segment: "evidence",
      script: `${tension} So let us separate the signal from the certainty: several sources point to the same editorial pressure, but repetition is not proof and attention is not a verdict.`,
    },
    {
      segment: "reveal",
      script: `${secondTension} This is the gap on the cutting-room floor: we can show what the available record supports, and we can name what it cannot settle. We do not get to invent the missing scene.`,
    },
    {
      segment: "uncertainty",
      script: `${secondTension} This is the gap on the cutting-room floor: we can show what the available record supports, and we can name what it cannot settle. We do not get to invent the missing scene.`,
    },
    {
      segment: "closing_button",
      script: `${archetypePerspective} The useful question is not “who can we blame?” It is “what changes when the audience can inspect the source trail for itself?” That is where this story gets more interesting—and more honest.`,
    },
  ];
  return {
    id: `script-${brief.id}`,
    brief_id: brief.id,
    run_id: brief.run_id,
    attestation_id: brief.attestation_id,
    status: "draft",
    title: brief.suggested_title,
    sections: spokenSections.map((item) => ({
      segment: item.segment,
      script: item.script,
      source_ids: sourceIds,
      classification: item.segment === "uncertainty" ? "unresolved" as const : item.segment === "reveal" ? "disputed" as const : "source_backed" as const,
      speaker: ["banter", "reveal", "closing_button"].includes(item.segment) ? "BACKSTAGE" as const : "FRONT ROW" as const,
    })),
    provenance: brief.source_links,
    safety_note:
      "Performed sample summarizes recurring public patterns. It contains no verbatim social comments, personal targeting, or unsupported audience-wide claims.",
    review_note:
      "Draft only. A separate human script review is required before any audio workflow.",
    audio_status: "blocked_until_script_approval",
    audio_clip: null,
    compatibility_normalized: false,
    workspace_revision: randomUUID(),
    release_kit: null,
  };
}

function podcastWorkspaceMatchesBrief(
  script: PodcastWorkspaceWithCompatibility,
  brief: PodcastBrief,
) {
  if (podcastExecutionRecords.has(`script:${script.id}`)) {
    const allowedSourceIds = new Set(brief.source_links.map((item) => item.source_id));
    return (
      script.brief_id === brief.id &&
      script.provenance.map((item) => item.source_id).join(",") ===
        brief.source_links.map((item) => item.source_id).join(",") &&
      script.sections.length === 6 &&
      script.sections.every(
        (section) =>
          section.source_ids.length > 0 &&
          section.source_ids.every((sourceId) => allowedSourceIds.has(sourceId)),
      ) &&
      script.sections.some((section) => section.speaker === "FRONT ROW") &&
      script.sections.some((section) => section.speaker === "BACKSTAGE") &&
      script.sections.some(
        (section) =>
          section.segment === "uncertainty" &&
          section.classification === "unresolved",
      )
    );
  }
  const hasEditorialSelection = Boolean(brief.selected_format || brief.editorial_archetype);
  if (!hasEditorialSelection && script.compatibility_normalized) return true;
  return (
    script.title === brief.suggested_title &&
    script.provenance.map((item) => item.source_id).join(",") ===
      brief.source_links.map((item) => item.source_id).join(",") &&
    script.sections[0]?.script.includes(brief.topic_angle.toLowerCase()) &&
    script.sections[0]?.script.startsWith(performedFormatOpening(brief)) &&
    script.sections.at(-1)?.script.startsWith(performedArchetypePerspective(brief))
  );
}

function discardPodcastWorkspace(script: PodcastWorkspaceWithCompatibility) {
  podcastScripts.delete(script.id);
  if (currentScript?.id === script.id) currentScript = null;
  if (script.audio_clip) {
    const audioPath = getPodcastAudioPath(script.audio_clip.id);
    if (audioPath) {
      try {
        unlinkSync(audioPath);
      } catch {
        // The workspace is still invalidated even if an orphaned local clip cannot be removed.
      }
    }
  }
}

function fixtureReleaseKit(script: PodcastWorkspaceWithCompatibility): PodcastReleaseKit {
  return {
    id: `release-kit-${script.id}`,
    script_id: script.id,
    status: "staged",
    title_options: [
      script.title,
      "The Scene Between the Scenes",
      "What the Edit Leaves Behind",
    ],
    episode_description:
      "A source-backed conversation about how editing shapes what audiences can reconstruct, and how to make room for uncertainty without turning curiosity into a verdict.",
    chapters: [
      { label: "The shared question", timing: "00:00–04:00", purpose: "Name the recurring audience gap without targeting a person." },
      { label: "What the sources support", timing: "04:00–13:00", purpose: "Separate repeated public patterns from claims the evidence cannot resolve." },
      { label: "The edit and the uncertainty", timing: "13:00–24:00", purpose: "Explore format-level explanations and the boundary of responsible recap." },
      { label: "A better way to clarify", timing: "24:00–30:00", purpose: "Offer a useful next question for producers, media teams, and listeners." },
    ],
    host_notes: [
      "Lead with the audience question, not the loudest accusation.",
      "Name the source window and confidence level before making an interpretive turn.",
      "Keep unresolved questions open; do not convert them into identity-sensitive claims.",
    ],
    promotion_copy: [
      { channel: "show notes", copy: "What happens when an edit leaves a timeline gap? We trace the question, the evidence, and the uncertainty." },
      { channel: "newsletter", copy: "A calmer recap starts by separating what viewers noticed from what the evidence can actually explain." },
      { channel: "social draft", copy: "New episode draft: the scene between the scenes — a source-backed look at editing, context, and better questions." },
    ],
    accessibility_notes: [
      "Publish a complete transcript with speaker labels and chapter timestamps.",
      "Describe editorial uncertainty in plain language rather than relying on tone or audio cues.",
      "Keep source links and the provenance summary available alongside the episode notes.",
    ],
    provenance_summary: `${script.provenance.length} retrieved public sources are attached to the approved script. The package summarizes patterns without reproducing user comments verbatim.`,
    audio_status: "awaiting_audio_approval",
    publishing_status: "blocked_until_final_approval",
    next_reviewer: "Final producer / publishing approver",
  };
}

const compatibilityBrief = fixtureBrief("concept-edit-context", podcastConcepts[0].source_ids);
const compatibilityScript = {
  ...fixtureScript(compatibilityBrief),
  status: "approved" as const,
  release_kit: fixtureReleaseKit({
    ...fixtureScript(compatibilityBrief),
    status: "approved" as const,
  }),
};

/**
 * Snapshot of the storage format written before release-kit field names were
 * aligned with the API contract. It intentionally omits newer optional fields.
 */
export const olderPersistedPodcastWorkspaceFixture: PersistedPodcastStateInput = {
  briefs: [{ ...compatibilityBrief, status: "approved" }],
  scripts: [
    {
      ...compatibilityScript,
      release_kit: {
        ...compatibilityScript.release_kit,
        titles: compatibilityScript.release_kit.title_options,
        promotion_drafts: compatibilityScript.release_kit.promotion_copy,
      },
    },
  ],
  currentBriefId: compatibilityBrief.id,
  currentScriptId: compatibilityScript.id,
};

/**
 * Older persisted workspaces can contain scripts for briefs that were never
 * approved. Keep both blocked statuses in one snapshot so API retrieval tests
 * exercise restoration rather than only the in-memory decision path.
 */
export const blockedLegacyPodcastWorkspaceFixture: PersistedPodcastStateInput = {
  briefs: (["draft", "rejected"] as const).map((status) => ({
    ...compatibilityBrief,
    id: `legacy-${status}-brief`,
    status,
  })),
  scripts: (["draft", "rejected"] as const).map((status) => ({
    ...compatibilityScript,
    id: `script-legacy-${status}-brief`,
    brief_id: `legacy-${status}-brief`,
    status,
    release_kit: {
      ...compatibilityScript.release_kit,
      titles: compatibilityScript.release_kit.title_options,
      promotion_drafts: compatibilityScript.release_kit.promotion_copy,
    },
  })),
  currentBriefId: "legacy-draft-brief",
  currentScriptId: "script-legacy-draft-brief",
};

export function createPodcastScript(briefId: string) {
  const brief = podcastBriefs.get(briefId) ?? (currentBrief?.id === briefId ? currentBrief : null);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  currentBrief = brief;
  const existing = podcastScripts.get(`script-${brief.id}`);
  if (existing && !podcastWorkspaceMatchesBrief(existing, brief)) {
    discardPodcastWorkspace(existing);
  }
  currentScript = existing && podcastWorkspaceMatchesBrief(existing, brief)
    ? existing
    : fixtureScript(brief);
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("create", "script_workspace");
  return { kind: "created" as const, script: currentScript };
}

/** The HTTP production path is asynchronous; the legacy synchronous creator is
 * retained only for explicit synthetic-demo fixtures and compatibility tests. */
export async function createPodcastScriptFromGemini(briefId: string) {
  if (process.env.PODCAST_SYNTHETIC_DEMO === "true") return createPodcastScript(briefId);
  const brief = podcastBriefs.get(briefId);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  const run = brief.run_id ? podcastGroundedRuns.get(brief.run_id) ?? null : null;
  const attestation = brief.attestation_id ? podcastAttestations.get(brief.run_id ?? "") : null;
  if (!run || !attestation || run.id !== brief.run_id || attestation.id !== brief.attestation_id || !runForPodcastArtifact(brief.concept_id, brief.selected_source_ids)) throw new Error("Bound grounded run and attestation are required.");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini script generation is not configured.");
  const started = Date.now();
  const response = await yieldPodcastMutationLock(() => new GoogleGenAI({ apiKey }).models.generateContent({
    model,
    contents: `Create fresh performed podcast dialogue for the exact query, sources, uncertainties, approved brief, format and fictional archetype below. Return JSON {title,sections}. Exactly six sections, in this order: cold_open, banter, evidence, reveal, uncertainty, closing_button. Every section has segment, script, speaker (FRONT ROW or BACKSTAGE), classification (source_backed, first_party_attested, disputed, unresolved), source_ids. Include both speakers; uncertainty must be unresolved. Never write production instructions, source IDs aloud, allegations, or raw private text. Only this permitted public attestation summary may be used: ${attestation.permitted_public_summary ?? "None"}.\nQUERY:${run.query}\nSOURCES:${JSON.stringify(run.sources)}\nUNCERTAINTIES:${JSON.stringify(run.uncertainties)}\nBRIEF:${JSON.stringify(brief)}\nFORMAT:${JSON.stringify(brief.selected_format)}\nARCHETYPE:${JSON.stringify(brief.editorial_archetype)}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "sections"],
        properties: {
          title: { type: "string", minLength: 1 },
          sections: {
            type: "array",
            minItems: 6,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["segment", "script", "speaker", "classification", "source_ids"],
              properties: {
                segment: { type: "string", enum: ["cold_open", "banter", "evidence", "reveal", "uncertainty", "closing_button"] },
                script: { type: "string", minLength: 1 },
                speaker: { type: "string", enum: ["FRONT ROW", "BACKSTAGE"] },
                classification: { type: "string", enum: ["source_backed", "first_party_attested", "disputed", "unresolved"] },
                source_ids: { type: "array", minItems: 1, items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  }));
  const parsed = JSON.parse(response.text ?? "{}") as { title?: unknown; sections?: unknown };
  const valid = validateGeneratedScript(parsed, run, attestation);
  const base = fixtureScript(brief);
  const script: PodcastWorkspaceWithCompatibility = { ...base, title: valid.title, sections: valid.sections, run_id: run.id, attestation_id: attestation.id, workspace_revision: randomUUID() };
  podcastExecutionRecords.set(`script:${script.id}`, { agent: "script_performer", provider: "Google Gemini", model, execution_id: randomUUID(), tools: [], latency_ms: Date.now() - started, status: "completed", activity: "Created structured performed copy." });
  currentScript = script;
  podcastScripts.set(script.id, script);
  persistPodcastState("create", "script_workspace");
  recordAgentStage("PODCAST-SCRIPT", "draft", script.id, `Gemini performed script ${Date.now() - started}ms`);
  return { kind: "created" as const, script };
}

export function validateGeneratedScript(parsed: { title?: unknown; sections?: unknown }, run: PodcastGroundedRun, attestation: PodcastCuttingRoomAttestation & { raw_text?: string }) {
  if (!nonEmptyString(parsed.title) || !Array.isArray(parsed.sections) || parsed.sections.length !== 6) throw new Error("Malformed Gemini script output.");
  const beats = ["cold_open", "banter", "evidence", "reveal", "uncertainty", "closing_button"];
  const ids = new Set(run.sources.map((source) => source.id));
  const allowedClasses = new Set(["source_backed", "first_party_attested", "disputed", "unresolved"]);
  const sections = parsed.sections.map((item, index) => {
    const s = item as Record<string, unknown>;
    if (s.segment !== beats[index] || !nonEmptyString(s.script) || !["FRONT ROW", "BACKSTAGE"].includes(s.speaker as string) || !allowedClasses.has(s.classification as string) || !Array.isArray(s.source_ids) || !s.source_ids.length || !s.source_ids.every((id) => typeof id === "string" && ids.has(id)) || /\b(open with|say|instructions?|stage direction)\b/i.test(s.script) || (attestation.raw_text && s.script.includes(attestation.raw_text))) throw new Error("Malformed or unsafe Gemini script output.");
    if (s.classification === "first_party_attested" && (!attestation.attested || !attestation.authorized_uses.includes("podcast_script"))) throw new Error("First-party attested script line is outside the authorized use scope.");
    return { segment: s.segment, script: s.script, speaker: s.speaker, classification: s.classification, source_ids: s.source_ids } as PodcastWorkspaceWithCompatibility["sections"][number];
  });
  if (!sections.some((s) => s.speaker === "FRONT ROW") || !sections.some((s) => s.speaker === "BACKSTAGE") || sections[4]?.classification !== "unresolved") throw new Error("Malformed Gemini script speaker or uncertainty beat.");
  return { title: parsed.title, sections };
}

export function getPodcastScriptByBriefId(briefId: string) {
  const brief = podcastBriefs.get(briefId) ?? (currentBrief?.id === briefId ? currentBrief : null);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  const script = podcastScripts.get(`script-${brief.id}`);
  if (!script) return { kind: "not_found" as const };
  if (!podcastWorkspaceMatchesBrief(script, brief)) {
    discardPodcastWorkspace(script);
    persistPodcastState("invalidate", "script_workspace");
    return { kind: "not_found" as const };
  }
  currentBrief = brief;
  currentScript = script;
  return { kind: "found" as const, script };
}

export function getPodcastScriptById(scriptId: string) {
  const script = podcastScripts.get(scriptId) ?? (currentScript?.id === scriptId ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  const brief = podcastBriefs.get(script.brief_id);
  if (!brief || brief.status !== "approved") return { kind: "brief_not_approved" as const };
  if (!podcastWorkspaceMatchesBrief(script, brief)) {
    discardPodcastWorkspace(script);
    persistPodcastState("invalidate", "script_workspace");
    return { kind: "not_found" as const };
  }
  currentBrief = brief;
  currentScript = script;
  return { kind: "found" as const, script };
}

export function isBlockedLegacyPodcastBrief(id: string) {
  const brief = podcastBriefs.get(id);
  const script = [...podcastScripts.values()].find((item) => item.brief_id === id);
  return Boolean(brief && brief.status !== "approved" && script?.compatibility_normalized);
}

export function decidePodcastScript(id: string, decision: "approve" | "reject") {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return null;
  currentScript = {
    ...script,
    status: decision === "approve" ? "approved" : "rejected",
    review_note:
      decision === "approve"
        ? "Approved by a human script reviewer. Audio work remains a separate production decision."
        : "Rejected by a human script reviewer. No audio rendering or publishing is permitted.",
  };
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("decision", "script_workspace");
  return currentScript;
}

export function createPodcastReleaseKit(scriptId: string) {
  const script = podcastScripts.get(scriptId) ?? (currentScript?.id === scriptId ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.status !== "approved") return { kind: "script_not_approved" as const };
  const releaseKit = script.release_kit ?? fixtureReleaseKit(script);
  currentScript = { ...script, release_kit: releaseKit, audio_status: "awaiting_audio_approval" };
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("create", "release_kit");
  return { kind: "created" as const, releaseKit };
}

export async function searchPodcastContexts(
  query: string,
  audience: string,
  useCase: string,
  provider: "google_public_web" = "google_public_web",
  window: "past_24_hours" | "past_7_days" | "past_30_days" = "past_7_days",
  sourceClasses: string[] = [],
): Promise<PodcastContextSearchResponse> {
  if (process.env.PODCAST_SYNTHETIC_DEMO !== "true") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Google Search grounded podcast search is not configured; set PODCAST_SYNTHETIC_DEMO=true only for an explicit demo.");
    const started = Date.now();
    const ai = new GoogleGenAI({ apiKey });
    const windowLabel = {
      past_24_hours: "the past 24 hours",
      past_7_days: "the past 7 days",
      past_30_days: "the past 30 days",
    }[window];
    const windowDays = { past_24_hours: 1, past_7_days: 7, past_30_days: 30 }[window];
    const before = new Date();
    before.setUTCDate(before.getUTCDate() + 1);
    const after = new Date();
    after.setUTCDate(after.getUTCDate() - windowDays);
    const googleDateOperators = `after:${after.toISOString().slice(0, 10)} before:${before.toISOString().slice(0, 10)}`;
    const scout = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
      contents: `Search the public web for current context about this exact podcast development topic: ${query}. Restrict every Google query to ${windowLabel} by including these date operators: ${googleDateOperators}. Return only a concise, aggregate, non-alleging evidence inventory. Do not return identities, usernames, raw comments, quotations, or copied post text.`,
      config: { tools: [{ googleSearch: {} }] },
    }));
    const chunks = scout.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const supports = scout.candidates?.[0]?.groundingMetadata?.groundingSupports ?? [];
    const web = chunks.flatMap((chunk: any, chunkIndex: number) =>
      chunk.web?.uri && chunk.web?.title ? [{ ...chunk.web, chunkIndex }] : []);
    let unique = [...new Map(web.map((item: any) => [item.uri, item])).values()].slice(0, 5);
    if (unique.length < 3) throw new Error("Google Search returned fewer than three unique web sources.");
    const sourceIndexByChunk = new Map(
      unique.map((item: any, sourceIndex) => [item.chunkIndex, sourceIndex + 1]),
    );
    let evidenceInventory: { source_refs: number[]; aggregate_text: string }[] = supports.flatMap((support: any) => {
      const text = support.segment?.text?.trim();
      const sourceRefs = (support.groundingChunkIndices ?? [])
        .map((chunkIndex: number) => sourceIndexByChunk.get(chunkIndex))
        .filter((sourceIndex: number | undefined): sourceIndex is number => sourceIndex !== undefined);
      return text && sourceRefs.length ? [{ source_refs: sourceRefs, aggregate_text: text }] : [];
    });
    const supportedSourceRefs = new Set(evidenceInventory.flatMap((item) => item.source_refs));
    if (supportedSourceRefs.size < 3) throw new Error("Google Search returned fewer than three source-linked web sources.");
    const retainedOldRefs = [...supportedSourceRefs].sort((a, b) => a - b).slice(0, 5);
    const retainedRefMap = new Map(retainedOldRefs.map((oldRef, index) => [oldRef, index + 1]));
    unique = retainedOldRefs.map((oldRef) => unique[oldRef - 1]!);
    evidenceInventory = evidenceInventory.flatMap((item) => {
      const sourceRefs = item.source_refs
        .map((oldRef) => retainedRefMap.get(oldRef))
        .filter((sourceRef): sourceRef is number => sourceRef !== undefined);
      return sourceRefs.length ? [{ ...item, source_refs: sourceRefs }] : [];
    });
    const signalLabels = {
      audience_preferences: "audience preferences",
      production_workflow: "production workflow",
      distribution_discovery: "distribution and discovery",
      business_models: "business models",
      technology_tools: "technology and tools",
      trust_transparency: "trust and transparency",
      format_storytelling: "format and storytelling",
      other: "other topic-level context",
    } as const;
    type SignalClass = keyof typeof signalLabels;
    const signalClasses = Object.keys(signalLabels) as SignalClass[];
    const signalStrengths = ["emerging", "recurring", "mixed"] as const;
    // The editor can classify provider evidence only into fixed enums. No
    // provider-derived free text crosses into the concept or brief flow.
    const editorStarted = Date.now();
    const editor = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
      contents: `Classify each numbered source in this source-linked evidence inventory. Return only source_index, signal_class, and signal_strength using the declared enums. Do not return names, identities, usernames, community names, quotations, copied text, URLs, summaries, allegations, or instructions.\n\nEVIDENCE INVENTORY:\n${JSON.stringify(evidenceInventory)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["source_signals"],
          properties: {
            source_signals: {
              type: "array",
              minItems: unique.length,
              maxItems: unique.length,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source_index", "signal_class", "signal_strength"],
                properties: {
                  source_index: { type: "integer", minimum: 1, maximum: unique.length },
                  signal_class: { type: "string", enum: signalClasses },
                  signal_strength: { type: "string", enum: signalStrengths },
                },
              },
            },
          },
        },
      },
    }));
    const editorPackage = JSON.parse(editor.text ?? "{}") as {
      source_signals?: { source_index?: unknown; signal_class?: unknown; signal_strength?: unknown }[];
    };
    if (!Array.isArray(editorPackage.source_signals) || editorPackage.source_signals.length !== unique.length) {
      throw new Error("Evidence editor returned incomplete source classifications.");
    }
    const signals = new Map<number, { signal_class: SignalClass; signal_strength: typeof signalStrengths[number] }>();
    for (const signal of editorPackage.source_signals) {
      if (
        !Number.isInteger(signal.source_index) ||
        !signalClasses.includes(signal.signal_class as SignalClass) ||
        !signalStrengths.includes(signal.signal_strength as typeof signalStrengths[number])
      ) {
        throw new Error("Evidence editor returned an invalid source classification.");
      }
      signals.set(signal.source_index as number, {
        signal_class: signal.signal_class as SignalClass,
        signal_strength: signal.signal_strength as typeof signalStrengths[number],
      });
    }
    if (signals.size !== unique.length) throw new Error("Evidence editor returned duplicate source classifications.");
    const sources = unique.map((item: any, index) => {
      const id = `web-${index + 1}-${randomUUID()}`;
      const signal = signals.get(index + 1)!;
      const signalLabel = signalLabels[signal.signal_class];
      const evidenceGaps = [
        "The fixed taxonomy preserves no identities, quotations, copied comments, or provider-derived free text.",
        "The bounded result does not establish intent, identity, representativeness, or platform-wide opinion.",
        `Publication timing within ${windowLabel} depends on provider metadata and was not independently verified.`,
      ];
      return {
        id,
        url: item.uri,
        source_identifier: createHash("sha256").update(item.uri).digest("hex").slice(0, 16),
        title: `Approved public-web result ${index + 1}`,
        retrieved_at: now(),
        snippet: "",
        source_type: "public_web",
        classification: "source_backed" as const,
        consent_reference: publicWebConsentReference,
        policy_reference: currentContextPolicyReference,
        aggregate_summary: `Provider-linked source ${index + 1} contributed a ${signal.signal_strength} aggregate signal about ${signalLabel}.`,
        evidence_gaps: evidenceGaps,
        what_it_supports: `A ${signal.signal_strength} topic-level signal about ${signalLabel}.`,
        what_remains_uncertain: evidenceGaps.join(" "),
      };
    });
    const observedLabels = [...new Set([...signals.values()].map((signal) => signalLabels[signal.signal_class]))];
    const observedContext = observedLabels.join(", ");
    const unresolvedQuestions = [
      "The provider-requested time bound was not independently verified from publication metadata.",
      "The aggregate taxonomy cannot establish identity, intent, representativeness, or platform-wide opinion.",
    ];
    const concept: PodcastConcept = {
      id: `concept-${randomUUID()}`,
      title: "Current aggregate context for producer review",
      summary: `${sources.length} provider-linked public sources contributed identity-free taxonomy signals about ${observedContext}.`,
      relevance: 0.5,
      urgency: 0.5,
      engagement: 0.5,
      freshness: 0.5,
      source_diversity: 1,
      source_ids: sources.map((source) => source.id),
      observed_signal: `The retained sources classify into: ${observedContext}.`,
      supported_context: "Only fixed taxonomy labels, source URLs, hashed identifiers, retrieval metadata, and explicit gaps enter development.",
      unresolved_questions: unresolvedQuestions,
      recommended_route: "producer_review",
      next_reviewer: "Producer / standards reviewer",
      confidence_label: "bounded · source-grounded",
      freshness_label: "retrieved this run",
      status: "needs_review",
    };
    const run: PodcastGroundedRun = {
      id: `run-${randomUUID()}`, query, provider, window, policy_reference: currentContextPolicyReference, runtime_status: "Live Gemini", sources, concept,
      uncertainties: unresolvedQuestions,
      grounding_support: "Google Search grounding metadata supplied the cited public web sources.",
      agent_executions: [
        { agent: "source_scout", provider: "Google Gemini", model, execution_id: randomUUID(), tools: ["googleSearch"], latency_ms: Date.now() - started, status: "completed", activity: "Retrieved unique public web sources with Google Search grounding." },
        { agent: "evidence_editor", provider: "Google Gemini", model, execution_id: randomUUID(), tools: [], latency_ms: Date.now() - editorStarted, status: "completed", activity: "Classified supported evidence into a fixed identity-free taxonomy." },
      ],
    };
    podcastGroundedRuns.set(run.id, run);
    const roomSources = groundedRunRoomSources(run);
    rehydrateActiveGroundedIndexes();
    persistPodcastState("create", "grounded_run");
    return { query, audience, use_case: useCase, provider, window, policy_reference: currentContextPolicyReference, generated_at: now(), search_mode: "google_search_grounded", grounded_run: run, results: [{ concept, sources: roomSources, match_reason: `Google public-web search was run with the requested ${windowLabel} bound; source publication timing remains an explicit evidence gap.`, speculation: "Unresolved questions remain unverified.", safest_next_reviewer: concept.next_reviewer }] };
  }
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const allowedSources = allPodcastSources().filter(
    (source) => !sourceClasses.length || sourceClasses.includes(source.source_class ?? source.platform),
  );
  const scored = allPodcastConcepts().map((concept) => {
    const sources = concept.source_ids
      .map((id) => allowedSources.find((source) => source.id === id))
      .filter(Boolean) as PodcastSource[];
    const haystack = [
      concept.title,
      concept.summary,
      concept.observed_signal,
      concept.supported_context,
      ...sources.flatMap((source) => [source.platform, source.community, source.post_title, source.source_class ?? ""]),
    ].join(" ").toLowerCase();
    const termMatches = terms.filter((term) => haystack.includes(term)).length;
    const score = termMatches * 2 + concept.relevance + sources.length * 0.08;
    return { concept, sources, score, termMatches };
  }).filter((item) => item.sources.length > 0)
    .sort((a, b) => b.score - a.score);
  const selected = scored.some((item) => item.termMatches > 0)
    ? scored.filter((item) => item.termMatches > 0)
    : scored.slice(0, 3);
  return {
    query,
    audience,
    use_case: useCase,
    generated_at: now(),
    search_mode: "synthetic_demo",
    provider: "synthetic_fixture",
    window,
    policy_reference: currentContextPolicyReference,
    grounded_run: createSyntheticGroundedRun(query, window),
    results: selected.map(({ concept, sources, termMatches }) => ({
      concept,
      sources,
      match_reason: termMatches
        ? `${termMatches} query signal${termMatches === 1 ? "" : "s"} matched across ${sources.length} cited sources for ${audience}.`
        : `Closest source-backed entertainment context for the ${useCase.replaceAll("_", " ")} use case.`,
      speculation: "Unresolved questions remain explicitly unverified and must not be presented as fact.",
      safest_next_reviewer: concept.next_reviewer,
    })),
  };
}

function createSyntheticGroundedRun(
  query: string,
  window: "past_24_hours" | "past_7_days" | "past_30_days",
): PodcastGroundedRun {
  const sources = podcastSources.slice(0, 3).map((source) => ({
    id: source.id,
    url: source.source_url,
    source_identifier: source.source_id ?? source.id,
    title: source.post_title,
    retrieved_at: source.retrieved_at,
    snippet: "Synthetic demonstration source; not a live web retrieval.",
    source_type: "synthetic_demo",
    consent_reference: null,
    policy_reference: "synthetic-fixture-policy-v1",
    aggregate_summary: "Synthetic topic-level fixture; no live retrieval or individual identity is represented.",
    evidence_gaps: ["This fixture is not current public-web evidence."],
    classification: "source_backed" as const,
    what_it_supports: "A synthetic demonstration of the source-backed workflow.",
    what_remains_uncertain: "It is not current public-web evidence.",
  }));
  const concept = podcastConcepts[0]!;
  const run: PodcastGroundedRun = {
    id: `run-demo-${randomUUID()}`,
    query,
    provider: "synthetic_fixture",
    window,
    policy_reference: "synthetic-fixture-policy-v1",
    runtime_status: "Synthetic Demo",
    sources,
    concept,
    uncertainties: concept.unresolved_questions,
    grounding_support: "Synthetic demonstration only; no live Google Search retrieval occurred.",
    agent_executions: [
      { agent: "source_scout", provider: "synthetic-demo", model: "none", execution_id: randomUUID(), tools: [], latency_ms: 0, status: "completed", activity: "Prepared synthetic demo sources." },
      { agent: "evidence_editor", provider: "synthetic-demo", model: "none", execution_id: randomUUID(), tools: [], latency_ms: 0, status: "completed", activity: "Prepared one synthetic demo concept and uncertainties." },
    ],
  };
  podcastGroundedRuns.set(run.id, run);
  rehydrateActiveGroundedIndexes();
  persistPodcastState("create", "grounded_run");
  return run;
}

export function attestPodcastCuttingRoom(
  runId: string,
  input: { decision: "add" | "decline"; raw_text?: string; permitted_public_summary?: string; authorized_uses?: string[] },
  signer: string,
) {
  if (!podcastGroundedRuns.has(runId)) return null;
  const existing = podcastAttestations.get(runId);
  if (existing) {
    const { raw_text: existingRaw, ...safeExisting } = existing;
    const same = existing.decision === input.decision &&
      (input.decision === "decline" || (existingRaw === input.raw_text?.trim() && existing.permitted_public_summary === input.permitted_public_summary?.trim() && existing.signer === signer.trim() && JSON.stringify(existing.authorized_uses) === JSON.stringify(input.authorized_uses ?? [])));
    return same ? safeExisting : "immutable" as const;
  }
  if (input.decision === "add" && (!nonEmptyString(input.raw_text) || !nonEmptyString(input.permitted_public_summary) || !nonEmptyString(signer) || !input.authorized_uses?.length)) {
    return false;
  }
  const attestation: PodcastCuttingRoomAttestation & { raw_text?: string } = {
    id: `attestation-${randomUUID()}`,
    run_id: runId,
    decision: input.decision,
    attested: input.decision === "add",
    signer: input.decision === "add" ? signer.trim() : null,
    permitted_public_summary: input.decision === "add" ? input.permitted_public_summary!.trim() : null,
    authorized_uses: input.decision === "add" ? input.authorized_uses! : [],
    created_at: now(),
    ...(input.decision === "add" ? { raw_text: input.raw_text!.trim() } : {}),
  };
  podcastAttestations.set(runId, attestation);
  persistPodcastState("create", "cutting_room_attestation");
  // Never return raw_text even to this route response.
  const { raw_text: _raw, ...safe } = attestation;
  return safe;
}

export function resetPodcastDemo(producerId: string) {
  currentBrief = null;
  currentScript = null;
  podcastBriefs.clear();
  podcastScripts.clear();
  podcastDevelopmentPlans.clear();
  podcastGroundedRuns.clear();
  podcastAttestations.clear();
  podcastCutKeys.clear();
  podcastAudioAssets.clear();
  activeGroundedSources.splice(0);
  activeGroundedConcepts.splice(0);
  persistPodcastState("reset", "podcast_demo");
  return {
    room: getPodcastRoom(producerId),
    pre_staged_input: {
      query: "editing context and audience trust",
      audience: "consumers" as const,
      use_case: "recap" as const,
      provider: "google_public_web" as const,
      window: "past_7_days" as const,
    },
  };
}

export function getPodcastCutKey(key: string) {
  return podcastCutKeys.get(key) ?? null;
}

export async function getPublicPodcastCutKey(key: string) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") {
    return podcastCutKeys.get(key) ?? null;
  }
  const stored = await loadPodcastStateFromDatabase();
  const state = stored?.state as PersistedPodcastState | undefined;
  const manifest = state?.cutKeys?.find((candidate) => candidate.key === key);
  if (!manifest) return null;
  return normalizeCutKeyGroundingSources({
    ...manifest,
    run_id: manifest.run_id ?? null,
    attestation_id: manifest.attestation_id ?? null,
  });
}

export async function getPublicPodcastAudioCutKey(key: string) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") {
    const manifest = podcastCutKeys.get(key);
    if (!manifest || manifest.superseded_by != null) return null;
    return activeGeneratedPodcastClip(manifest.clip_id) ? manifest : null;
  }
  const stored = await loadPodcastStateFromDatabase();
  const state = stored?.state as PersistedPodcastState | undefined;
  const manifest = state?.cutKeys?.find((candidate) => candidate.key === key);
  if (!manifest || manifest.superseded_by != null) return null;
  const active = state?.scripts.some(
    (script) => script.audio_status === "generated" && script.audio_clip?.id === manifest.clip_id,
  );
  if (!active) return null;
  return manifest;
}

export function getPodcastAudioPathByCutKey(key: string) {
  const manifest = podcastCutKeys.get(key);
  if (!manifest || manifest.superseded_by != null) return null;
  if (!activeGeneratedPodcastClip(manifest.clip_id)) return null;
  return getPodcastAudioPath(manifest.clip_id);
}

export async function getPodcastAudioFileByCutKey(key: string) {
  const manifest = await getPublicPodcastAudioCutKey(key);
  if (!manifest) return null;
  return getPodcastAudioFileForCutKey(manifest);
}

export async function getPodcastAudioFileForCutKey(manifest: PodcastCutKey) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return null;
  return getPodcastAudioFile(manifest.clip_id, manifest.audio_sha256);
}

export function getPodcastAudioPathForCutKey(manifest: PodcastCutKey) {
  const filePath = join(audioDirectory, `${manifest.clip_id}.wav`);
  if (!existsSync(filePath)) return null;
  const actualSha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  return actualSha256 === manifest.audio_sha256 ? filePath : null;
}

export function decidePodcastAudio(id: string, decision: "approve" | "reject") {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.status !== "approved" || !script.release_kit) return { kind: "not_ready" as const };
  const audioStatus = decision === "approve" ? "ready_to_generate" as const : "rejected" as const;
  const updated = {
    ...script,
    audio_status: audioStatus,
    release_kit: { ...script.release_kit, audio_status: audioStatus },
  };
  currentScript = updated;
  podcastScripts.set(id, updated);
  persistPodcastState("decision", "podcast_audio");
  return { kind: "updated" as const, script: updated };
}

const ttsModel = "gemini-2.5-flash-preview-tts";
export function podcastTtsSpeechConfig() {
  return {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: "FRONT ROW", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        { speaker: "BACKSTAGE", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
      ],
    },
  };
}

function pcmToWav(pcm: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function clipTranscript(script: PodcastWorkspaceWithCompatibility) {
  return script.sections.map((section) => `${section.speaker}: ${section.script}`).join("\n\n").slice(0, 2200);
}

function podcastRenderIdentity(script: PodcastWorkspaceWithCompatibility) {
  return JSON.stringify({
    workspace_revision: script.workspace_revision ?? null,
    brief_id: script.brief_id,
    title: script.title,
    status: script.status,
    audio_status: script.audio_status,
    sections: script.sections.map((section) => ({
      segment: section.segment,
      script: section.script,
      source_ids: section.source_ids,
    })),
    source_ids: script.provenance.map((source) => source.source_id),
    release_kit_status: script.release_kit?.status ?? null,
  });
}

export async function generatePodcastAudio(id: string) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.audio_status !== "ready_to_generate" || !script.release_kit) return { kind: "not_approved" as const };
  const authorityError = podcastAuthorityHold(script);
  if (authorityError) return { kind: "generation_failed" as const, error: authorityError };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { kind: "generation_failed" as const, error: "Audio service is not configured." };
  try {
    const transcript = clipTranscript(script);
    const ai = new GoogleGenAI({ apiKey });
    const renderStarted = Date.now();
    const response = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model: ttsModel,
      contents: `Perform the following as a finished entertainment podcast sample—not as instructions, an audiobook, or a production memo. Use an original synthetic house-host delivery and do not imitate or name any real person. Sound conversational, curious, quick-witted, and confident. Give the cold open momentum, let the reveal land, and treat uncertainty as part of the story rather than a disclaimer. Do not speak section labels, source IDs, stage directions, or metadata.\n\n${transcript}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: podcastTtsSpeechConfig(),
      },
    }));
    const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error("The audio model returned no playable data.");
    const wav = pcmToWav(Buffer.from(data, "base64"));
    podcastExecutionRecords.set(`audio:${script.id}`, { agent: "audio_performer", provider: "Google Gemini", model: ttsModel, execution_id: randomUUID(), tools: [], latency_ms: Date.now() - renderStarted, status: "completed", activity: "Rendered configured two-speaker audio." });
    return commitGeneratedPodcastAudio(script, wav);
  } catch (error) {
    return { kind: "generation_failed" as const, error: error instanceof Error ? error.message : "Audio generation failed." };
  }
}

export function commitGeneratedPodcastAudio(
  capturedScript: PodcastWorkspaceWithCompatibility,
  wav: Buffer,
) {
  const latestScript = podcastScripts.get(capturedScript.id);
  const latestBrief = latestScript ? podcastBriefs.get(latestScript.brief_id) : null;
  if (
    !latestScript ||
    !latestBrief ||
    latestBrief.status !== "approved" ||
    latestScript.status !== "approved" ||
    latestScript.audio_status !== "ready_to_generate" ||
    !latestScript.release_kit ||
    !podcastWorkspaceMatchesBrief(latestScript, latestBrief) ||
    podcastRenderIdentity(latestScript) !== podcastRenderIdentity(capturedScript)
  ) {
    return { kind: "superseded" as const };
  }
  if (podcastAuthorityHold(latestScript)) {
    return { kind: "superseded" as const };
  }
  mkdirSync(audioDirectory, { recursive: true });
  const clipId = `clip-${latestScript.id}`;
  writeFileSync(join(audioDirectory, `${clipId}.wav`), wav);
  enqueuePodcastPersistence(
    () => process.env.PODCAST_DURABILITY_DISABLED === "true"
      ? Promise.resolve()
      : uploadPodcastAudio(clipId, wav),
    "upload",
    "podcast_audio",
  );
  const clip: PodcastAudioClip = {
    id: clipId,
    script_id: latestScript.id,
    run_id: latestScript.run_id,
    attestation_id: latestScript.attestation_id,
    status: "ready",
    audio_url: `/api/podcast/audio/${clipId}/stream`,
    mime_type: "audio/wav",
    duration_seconds: Math.max(0, Math.round((wav.length - 44) / (24000 * 2))),
    transcript: clipTranscript(latestScript),
    voice_disclosure: "Original synthetic two-speaker house-host performance · FRONT ROW: Gemini Kore; BACKSTAGE: Gemini Puck · no voice cloning or impersonation",
    format_disclosure: "Short evidence-backed performed podcast sample · not published",
    source_ids: [...new Set(latestScript.provenance.map((source) => source.source_id))],
    provenance_summary: latestScript.release_kit.provenance_summary,
    generated_at: now(),
    cut_key: null,
  };
  const cutKey = createPodcastCutKey(latestScript, clip, wav);
  if (!cutKey) return { kind: "superseded" as const };
  podcastAudioAssets.set(clipId, cutKey.audio_sha256);
  clip.cut_key = cutKey.key;
  const updated = {
    ...latestScript,
    audio_status: "generated" as const,
    audio_clip: clip,
    release_kit: { ...latestScript.release_kit, audio_status: "generated" as const },
  };
  currentScript = updated;
  podcastScripts.set(latestScript.id, updated);
  persistPodcastState("generate", "podcast_audio");
  recordAgentStage("PODCAST-AUDIO", "render", latestScript.id, `${clip.id} · ${clip.duration_seconds}s · ${clip.source_ids.length} sources`);
  return { kind: "generated" as const, clip };
}

function podcastApprovalChain(
  script: PodcastWorkspaceWithCompatibility,
  brief: PodcastBrief,
): PodcastCutKey["approval_receipts"] | null {
  const receipts = [
    brief.development_plan_id ? podcastApprovalReceipts.get(`development:${brief.development_plan_id}`) : undefined,
    podcastApprovalReceipts.get(`brief:${script.brief_id}`),
    podcastApprovalReceipts.get(`script:${script.id}`),
    podcastApprovalReceipts.get(`audio:${script.id}`),
  ];
  return receipts.some((receipt) => !receipt)
    ? null
    : receipts as PodcastCutKey["approval_receipts"];
}

function podcastAuthorityHold(script: PodcastWorkspaceWithCompatibility) {
  const brief = podcastBriefs.get(script.brief_id);
  const run = brief?.run_id ? podcastGroundedRuns.get(brief.run_id) ?? null : null;
  if (!run || run.uncertainties.length === 0) return "Authority hold: an active grounded run with visible uncertainty is required.";
  if (!syntheticDemoEnabled() && run.runtime_status !== "Live Gemini") {
    return "Authority hold: normal mode requires a live Gemini grounded run.";
  }
  if (!brief || brief.status !== "approved" || script.status !== "approved" || script.audio_status !== "ready_to_generate") {
    return "Authority hold: approved brief, script, and audio decisions are required.";
  }
  if (!brief.development_plan_id || podcastDevelopmentPlans.get(brief.development_plan_id)?.status !== "validated") {
    return "Authority hold: validated development approval is required.";
  }
  if (!podcastApprovalChain(script, brief)) {
    return "Authority hold: development, brief, script, and audio approval receipts are required.";
  }
  const allowed = new Set(run.sources.map((source) => source.id));
  if (script.sections.some((section) => !section.source_ids.length || section.source_ids.some((id) => !allowed.has(id)))) {
    return "Authority hold: script cites sources outside the active grounded run.";
  }
  const attestation = podcastAttestations.get(run.id);
  if (!attestation || script.run_id !== run.id || script.attestation_id !== attestation.id || brief?.attestation_id !== attestation.id || !runForPodcastArtifact(brief!.concept_id, brief!.selected_source_ids)) return "Authority hold: bound run and attestation verification failed.";
  if (!script.sections.some((section) => section.segment === "uncertainty" && section.classification === "unresolved")) {
    return "Authority hold: an unresolved uncertainty beat is required.";
  }
  if (script.sections.some((section) => section.classification === "first_party_attested") && (!attestation.attested || !attestation.authorized_uses.includes("podcast_script"))) {
    return "Authority hold: first-party attested copy is outside the approved use scope.";
  }
  if (attestation.raw_text && script.sections.some((section) => section.script.includes(attestation.raw_text!))) {
    return "Authority hold: raw private cutting-room material cannot be performed.";
  }
  if (script.sections.some((section) => /\b(proves?|definitely|guilty|lied|cover[- ]?up)\b/i.test(section.script))) {
    return "Authority hold: unsupported allegation language requires human evidence review.";
  }
  return null;
}

function createPodcastCutKey(script: PodcastWorkspaceWithCompatibility, clip: PodcastAudioClip, wav: Buffer) {
  const brief = podcastBriefs.get(script.brief_id);
  const run = brief?.run_id ? podcastGroundedRuns.get(brief.run_id) ?? null : null;
  if (!run) return null;
  const attestation = podcastAttestations.get(run.id);
  if (!attestation || script.run_id !== run.id || script.attestation_id !== attestation.id || brief?.attestation_id !== attestation.id) return null;
  const receipts = brief ? podcastApprovalChain(script, brief) : null;
  if (!receipts) return null;
  const previous = [...podcastCutKeys.values()].find((item) => item.clip_id === clip.id && item.superseded_by === null);
  const key = `cut-${randomUUID()}`;
  if (previous) {
    podcastCutKeys.set(previous.key, { ...previous, superseded_by: key });
  }
  const manifest: PodcastCutKey = {
    key,
    clip_id: clip.id,
    run_id: script.run_id,
    attestation_id: script.attestation_id,
    audio_url: `/api/podcast/cut-keys/${key}/audio`,
    citations: run.sources,
    line_mappings: script.sections.map((section) => ({ segment: section.segment, text: section.script, speaker: section.speaker, classification: section.classification, source_ids: section.source_ids })),
    retrievals: run.sources.map((source) => source.retrieved_at),
    script_sha256: createHash("sha256").update(clip.transcript).digest("hex"),
    audio_sha256: createHash("sha256").update(wav).digest("hex"),
    approval_receipts: receipts,
    version: previous ? previous.version + 1 : 1,
    supersedes: previous?.key ?? null,
    superseded_by: null,
    executions: [...run.agent_executions, ...[podcastExecutionRecords.get(`script:${script.id}`), podcastExecutionRecords.get(`audio:${script.id}`)].filter(Boolean) as PodcastGroundedRun["agent_executions"], { agent: "authority_check", provider: "deterministic", model: "policy-v1", execution_id: randomUUID(), tools: [], latency_ms: 0, status: "completed", activity: "Confirmed approvals, citations, uncertainty, and private-content boundary." }],
    integrity_disclaimer: "This manifest verifies artifact lineage and integrity, not the truth of any claim.",
    private_attestation: {
      exists: attestation.decision === "add",
      classification: attestation.decision === "add" ? "first_party_attested" : null,
      signer: attestation.signer,
      permitted_public_summary: attestation.permitted_public_summary,
    },
  };
  podcastCutKeys.set(key, manifest);
  return manifest;
}

export function getPodcastAudioByScript(id: string) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  return script?.audio_clip ?? null;
}

export function getPodcastAudioPath(clipId: string) {
  if (!/^clip-[a-zA-Z0-9_-]+$/.test(clipId)) return null;
  const storedClip = activeGeneratedPodcastClip(clipId);
  if (!storedClip) return null;
  const expectedSha256 = [...podcastCutKeys.values()].find(
    (candidate) => candidate.clip_id === clipId && candidate.superseded_by === null,
  )?.audio_sha256 ?? podcastAudioAssets.get(clipId);
  if (!expectedSha256) return null;
  const filePath = join(audioDirectory, `${clipId}.wav`);
  if (!existsSync(filePath)) return null;
  const actualSha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  return actualSha256 === expectedSha256 ? filePath : null;
}

export async function getPodcastStoredAudioFile(clipId: string) {
  const storedClip = activeGeneratedPodcastClip(clipId);
  if (!storedClip) return null;
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return null;
  const manifest = [...podcastCutKeys.values()].find(
    (candidate) => candidate.clip_id === clipId && candidate.superseded_by === null,
  );
  const expectedSha256 = manifest?.audio_sha256 ?? podcastAudioAssets.get(clipId);
  if (!expectedSha256) return null;
  return getPodcastAudioFile(clipId, expectedSha256);
}

function activeGeneratedPodcastClip(clipId: string) {
  return [...podcastScripts.values()].find(
    (script) => script.audio_status === "generated" && script.audio_clip?.id === clipId,
  )?.audio_clip ?? null;
}

export function addPodcastSource(sourceUrl: string, producerId: string) {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;

  const isReddit = parsed.hostname.endsWith("reddit.com");
  const communityMatch = parsed.pathname.match(/\/r\/([^/]+)/i);
  const source: PodcastSource = {
    id: `manual-${Date.now()}`,
    source_url: sourceUrl,
    platform: isReddit ? "Reddit" : "Public web",
    community: communityMatch ? `r/${communityMatch[1]}` : parsed.hostname,
    post_title: "Manually supplied source — retrieval pending",
    timestamp: now(),
    retrieved_at: now(),
    engagement: { score: 0, comments: 0 },
    source_id: null,
    access_mode: "manual_url" as const,
  };
  podcastSources.unshift(source);
  return getPodcastRoom(producerId);
}

export async function generatePodcastBrief(
  conceptId: string,
  requestedSourceIds: string[],
  developmentPlanId?: string,
) {
  const concept = allPodcastConcepts().find((item) => item.id === conceptId);
  if (!concept) {
    if (!syntheticDemoEnabled()) throw new Error("No exact grounded concept is available for production brief generation.");
    return null;
  }

  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  const selectedSources = allPodcastSources().filter((source) => sourceIds.includes(source.id));
  const syntheticDemo = process.env.PODCAST_SYNTHETIC_DEMO === "true";
  const fallback = fixtureBrief(conceptId, sourceIds);
  const developmentPlan = developmentPlanId ? getPodcastDevelopmentPlan(developmentPlanId) : null;
  const selectedArchetype = developmentPlan?.archetypes.find(
    (item) => item.id === developmentPlan.selected_archetype_id,
  );
  const selectedFormat = developmentPlan?.format_variants.find(
    (item) => item.id === developmentPlan.selected_format_id,
  );
  const run = runForPodcastArtifact(conceptId, sourceIds);
  const attestation = run ? podcastAttestations.get(run.id) : null;
  if (!syntheticDemo && (!run || !attestation)) {
    throw new Error("Exact grounded run and attestation decision are required for a production brief.");
  }
  if (syntheticDemo) {
    currentBrief = {
      ...fallback,
      run_id: run?.id ?? null,
      attestation_id: attestation?.id ?? null,
      development_plan_id: developmentPlan?.id,
      editorial_archetype: selectedArchetype,
      selected_format: selectedFormat,
      methodology_summary: developmentPlan?.methodology_note,
    };
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState("create", "podcast_brief");
    return currentBrief;
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini brief generation is not configured; set PODCAST_SYNTHETIC_DEMO=true only for an explicit demo.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
        contents: `You are a read-only podcast development editor. Create a JSON podcast brief from the supplied audience concept, source metadata, fictional editorial lens, and format hypothesis. Do not quote comments verbatim, identify people, imitate a real person's style, invent facts, guarantee popularity, or publish or render anything. Preserve the supplied source links. Return fields topic_angle, audience_pain, why_now, key_tensions, risk_notes, episode_outline, suggested_title.\n\nCONCEPT:\n${JSON.stringify(concept)}\n\nSELECTED SOURCES:\n${JSON.stringify(selectedSources)}\n\nFICTIONAL EDITORIAL LENS:\n${JSON.stringify(selectedArchetype ?? null)}\n\nFORMAT HYPOTHESIS:\n${JSON.stringify(selectedFormat ?? null)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["topic_angle", "audience_pain", "why_now", "key_tensions", "risk_notes", "episode_outline", "suggested_title"],
          properties: {
            topic_angle: { type: "string", minLength: 1 },
            audience_pain: { type: "string", minLength: 1 },
            why_now: { type: "string", minLength: 1 },
            key_tensions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            risk_notes: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            episode_outline: {
              type: "array",
              minItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["segment", "purpose"],
                properties: {
                  segment: { type: "string", minLength: 1 },
                  purpose: { type: "string", minLength: 1 },
                },
              },
            },
            suggested_title: { type: "string", minLength: 1 },
          },
        },
      },
    }));
    const parsed = JSON.parse(response.text ?? "{}");
    const safeDraft = strictPodcastDraft(parsed, selectedSources);
    currentBrief = {
      ...fallback,
      ...safeDraft,
      run_id: run!.id,
      attestation_id: attestation!.id,
      generated_mode: "gemini",
      source_links: fallback.source_links,
      status: "draft",
      approval_note: fallback.approval_note,
      development_plan_id: developmentPlan?.id,
      editorial_archetype: selectedArchetype,
      selected_format: selectedFormat,
      methodology_summary: developmentPlan?.methodology_note,
    };
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState("create", "podcast_brief");
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, response.text ?? "{}");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Gemini runtime error.";
    recordAgentStage("PODCAST-BRIEF", "failed", concept.title, reason);
    throw new Error(`Gemini brief generation failed: ${reason}`);
  }
  return currentBrief;
}

export function strictPodcastDraft(parsed: unknown, sources: PodcastSource[]): GeneratedPodcastDraft {
  const candidate = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  if (!candidate) throw new Error("Malformed Gemini brief: expected an object.");
  const text = (name: keyof GeneratedPodcastDraft) => {
    const value = candidate[name];
    if (!nonEmptyString(value) || containsSourceText(value, sources)) throw new Error(`Malformed Gemini brief: invalid ${name}.`);
    return value;
  };
  const stringList = (name: "key_tensions" | "risk_notes") => {
    const value = candidate[name];
    if (!Array.isArray(value) || !value.length || !value.every((item) => nonEmptyString(item) && !containsSourceText(item, sources))) throw new Error(`Malformed Gemini brief: invalid ${name}.`);
    return value as string[];
  };
  const outline = candidate.episode_outline;
  if (!Array.isArray(outline) || !outline.length || !outline.every((item) => item && typeof item === "object" && nonEmptyString((item as any).segment) && nonEmptyString((item as any).purpose))) {
    throw new Error("Malformed Gemini brief: invalid episode_outline.");
  }
  return { topic_angle: text("topic_angle"), audience_pain: text("audience_pain"), why_now: text("why_now"), key_tensions: stringList("key_tensions"), risk_notes: stringList("risk_notes"), episode_outline: outline as PodcastBrief["episode_outline"], suggested_title: text("suggested_title") };
}

export function decidePodcastBrief(id: string, decision: "approve" | "reject") {
  if (!currentBrief || currentBrief.id !== id) return null;
  if (decision === "approve" && !isPodcastEvidenceSufficient(currentBrief)) {
    return {
      ...currentBrief,
      status: "draft" as const,
      approval_note:
        "Approval unavailable until evidence trail is sufficient.",
    };
  }
  currentBrief = {
    ...currentBrief,
    status: decision === "approve" ? "approved" : "rejected",
    approval_note:
      decision === "approve"
        ? "Approved by a human reviewer. Script and audio rendering may be considered in a later, separately gated workflow."
        : "Rejected by a human reviewer. No script or audio rendering is permitted from this brief.",
  };
  podcastBriefs.set(currentBrief.id, currentBrief);
  const existingScript = podcastScripts.get(`script-${currentBrief.id}`);
  if (existingScript && !podcastWorkspaceMatchesBrief(existingScript, currentBrief)) {
    discardPodcastWorkspace(existingScript);
  }
  persistPodcastState("decision", "podcast_brief");
  return currentBrief;
}

export function recordPodcastDecision(
  kind: "brief" | "script" | "audio",
  id: string,
  decision: "approve" | "reject",
  reviewer: string,
) {
  recordHumanDecision(kind, id, decision, reviewer);
  if (decision === "approve") podcastApprovalReceipts.set(`${kind}:${id}`, { stage: kind, reviewer, decided_at: now() });
  persistPodcastState("record_receipt", "podcast_approval");
}

export function recordPodcastDevelopmentReceipt(id: string, reviewer: string) {
  podcastApprovalReceipts.set(`development:${id}`, { stage: "development", reviewer, decided_at: now() });
  persistPodcastState("record_receipt", "podcast_approval");
}

export function isPodcastEvidenceSufficient(brief: PodcastBrief) {
  if (!brief.source_links.length) return false;
  return brief.source_links.every((link) => {
    const source = allPodcastSources().find((item) => item.id === link.source_id);
    return Boolean(
      source &&
        (source.access_mode === "approved_live" || source.access_mode === "fixture") &&
        !source.post_title.toLowerCase().includes("retrieval pending"),
    );
  });
}
